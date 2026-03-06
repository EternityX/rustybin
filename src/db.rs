use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use rand::{distributions::Alphanumeric, Rng};
use sqlite::{Connection, State};
use std::fs;
use thiserror::Error;
use sha2::{Sha256, Digest};

// Define the Paste struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paste {
    pub id: String,
    pub data: String,
    pub language: String,
    pub created_at: DateTime<Utc>,
    pub encryption_version: u8,
    pub burn_after_read: bool,
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edit_key: Option<String>, // Only returned on creation, never stored in plain text
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edit_key_hash: Option<String>, // Only returned for admin listing
}

// Data structure for creating a new paste
#[derive(Debug, Deserialize)]
pub struct CreatePasteData {
    pub data: String,
    pub language: String,
    #[serde(default)]
    pub burn_after_read: bool,
    #[serde(default)]
    pub expires_in_minutes: Option<u32>,
}

// Data structure for updating a paste
#[derive(Debug, Deserialize)]
pub struct UpdatePasteData {
    pub data: String,
    pub language: String,
    pub edit_key: String,
}

// Data structure for deleting a paste
#[derive(Debug, Deserialize)]
pub struct DeletePasteData {
    pub edit_key: String,
}

// Database error type
#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] sqlite::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Client-side encryption required")]
    ClientEncryptionRequired,
    
    #[error("Character limit exceeded: {0} characters (maximum: {1})")]
    CharacterLimitExceeded(usize, usize),
    
    #[error("Paste with ID already exists")]
    PasteAlreadyExists,
    
    #[error("Invalid edit key")]
    InvalidEditKey,
    
    #[error("Paste not found")]
    PasteNotFound,
    
    #[error("Failed to generate unique ID after maximum retries")]
    IdGenerationFailed,
}

// Database struct
#[derive(Clone)]
pub struct Database {
    connection: Arc<Mutex<Connection>>,
}

impl std::fmt::Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Database")
            .field("connection", &"<SQLite Connection>")
            .finish()
    }
}

// Internal struct for encrypted paste data
#[derive(Debug, Serialize, Deserialize)]
struct PasteData {
    title: String,
    data: String,
    language: String,
    description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyPasteStats {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_pastes: i64,
    pub pending_expiration: i64,
    pub unread_pastes: i64,
    pub total_size: i64,
    pub language_stats: std::collections::HashMap<String, i64>,
    pub pastes_over_time: Vec<DailyPasteStats>,
}

// Encryption version constants
const ENCRYPTION_VERSION_CLIENT: u8 = 1;

// Maximum character limit for pastes
const MAX_PASTE_CHARACTERS: usize = 200000;

// Maximum retries for ID generation
const MAX_ID_GENERATION_RETRIES: u32 = 10;

// Base ID length
const BASE_ID_LENGTH: usize = 6;

// Maximum expiration time in minutes (1 week)
const MAX_EXPIRES_IN_MINUTES: u32 = 10080;

impl Database {
    // Helper function to get precise UTF-8 byte count
    fn get_utf8_byte_count(text: &str) -> usize {
        text.as_bytes().len()
    }
    
    // Generate a random alphanumeric ID
    fn generate_id(length: usize) -> String {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(length)
            .map(char::from)
            .collect()
    }
    
    // Hash an edit key for storage
    fn hash_edit_key(edit_key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(edit_key.as_bytes());
        let result = hasher.finalize();
        base64::encode(result)
    }
    
    // Verify an edit key matches the stored hash
    fn verify_edit_key(edit_key: &str, stored_hash: &str) -> bool {
        let computed_hash = Self::hash_edit_key(edit_key);
        computed_hash == stored_hash
    }
    
    // Check if a paste ID already exists
    fn paste_exists(&self, id: &str) -> Result<bool, DbError> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT 1 FROM pastes WHERE id = ? LIMIT 1")?;
        stmt.bind((1, id))?;
        Ok(matches!(stmt.next()?, State::Row))
    }
    
    // Generate a unique paste ID with collision detection
    fn generate_unique_id(&self) -> Result<String, DbError> {
        for retry in 0..MAX_ID_GENERATION_RETRIES {
            // Increase ID length with retries to reduce collision probability
            let length = BASE_ID_LENGTH + (retry as usize);
            let id = Self::generate_id(length);
            
            if !self.paste_exists(&id)? {
                return Ok(id);
            }
            
            tracing::warn!("ID collision detected for '{}', retry {} with length {}", id, retry + 1, length + 1);
        }
        
        Err(DbError::IdGenerationFailed)
    }

    pub fn new() -> Self {
        // Ensure data directory exists
        let data_dir = PathBuf::from("data");
        fs::create_dir_all(&data_dir).expect("Failed to create data directory");
        
        // Initialize database connection
        let db_path = data_dir.join("pastes.db");
        let connection = Connection::open(db_path).expect("Failed to open database");
        
        // Enable foreign keys and WAL mode
        connection.execute("PRAGMA foreign_keys = ON;").expect("Failed to set foreign_keys pragma");
        connection.execute("PRAGMA journal_mode = WAL;").expect("Failed to set journal_mode pragma");
        
        // Create tables if they don't exist (includes all columns)
        connection.execute("
            CREATE TABLE IF NOT EXISTS pastes (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                language TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                encryption_version INTEGER NOT NULL DEFAULT 0,
                edit_key_hash TEXT,
                burn_after_read INTEGER NOT NULL DEFAULT 0,
                expires_at INTEGER
            );
        ").expect("Failed to create pastes table");
        
        // Migration: Add columns if they don't exist
        let _ = connection.execute("ALTER TABLE pastes ADD COLUMN edit_key_hash TEXT;");
        let _ = connection.execute("ALTER TABLE pastes ADD COLUMN burn_after_read INTEGER NOT NULL DEFAULT 0;");
        let _ = connection.execute("ALTER TABLE pastes ADD COLUMN expires_at INTEGER;");
        
        connection.execute("
            CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON pastes(created_at DESC);
        ").expect("Failed to create index");
        
        Self {
            connection: Arc::new(Mutex::new(connection)),
        }
    }
    
    // Store client-encrypted paste with edit key
    fn store_client_encrypted_paste(
        &self, 
        id: String, 
        data: String, 
        language: String, 
        created_at: DateTime<Utc>, 
        edit_key_hash: String,
        burn_after_read: bool,
        expires_at: Option<i64>
    ) -> Result<Paste, DbError> {
        let timestamp = created_at.timestamp() as i64;
        let burn_flag = if burn_after_read { 1 } else { 0 };
        
        // Insert into database
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT INTO pastes (id, data, language, created_at, encryption_version, edit_key_hash, burn_after_read, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )?;
        
        // Bind parameters
        stmt.bind((1, id.as_str()))?;
        stmt.bind((2, data.as_str()))?;
        stmt.bind((3, language.as_str()))?;
        stmt.bind((4, timestamp.to_string().as_str()))?;
        stmt.bind((5, ENCRYPTION_VERSION_CLIENT.to_string().as_str()))?;
        stmt.bind((6, edit_key_hash.as_str()))?;
        stmt.bind((7, burn_flag.to_string().as_str()))?;
        
        // Handle optional expires_at
        if let Some(exp) = expires_at {
            stmt.bind((8, exp.to_string().as_str()))?;
        } else {
            stmt.bind((8, sqlite::Value::Null))?;
        }
        
        stmt.next()?;

        Ok(Paste {
            id,
            data: String::new(), // Don't return the encrypted data on creation
            language,
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at: expires_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now())),
            edit_key: None, // Will be set by caller
            edit_key_hash: None,
        })
    }

    pub fn create_paste(&self, paste_data: CreatePasteData) -> Result<Paste, DbError> {
        // Check character limit before processing - using explicit UTF-8 byte count
        let byte_count = Self::get_utf8_byte_count(&paste_data.data);
        
        tracing::debug!("Paste data length (bytes): {}", byte_count);
        
        if byte_count > MAX_PASTE_CHARACTERS {
            return Err(DbError::CharacterLimitExceeded(byte_count, MAX_PASTE_CHARACTERS));
        }
        
        if paste_data.data.is_empty() {
            return Err(DbError::ClientEncryptionRequired);
        }
        
        // Validate expiration time (max 1 week = 10080 minutes)
        let expires_at = if let Some(minutes) = paste_data.expires_in_minutes {
            if minutes == 0 || minutes > MAX_EXPIRES_IN_MINUTES {
                return Err(DbError::CharacterLimitExceeded(minutes as usize, MAX_EXPIRES_IN_MINUTES as usize));
            }
            let expires_timestamp = Utc::now().timestamp() + (minutes as i64 * 60);
            Some(expires_timestamp)
        } else {
            None
        };
        
        // Generate unique ID with collision detection
        let id = self.generate_unique_id()?;
        
        // Generate edit key (32 bytes, base64 encoded)
        let edit_key = Self::generate_id(32);
        let edit_key_hash = Self::hash_edit_key(&edit_key);

        let now = Utc::now();
        
        // Store the client-encrypted paste with edit key hash and advanced options
        let mut paste = self.store_client_encrypted_paste(
            id,
            paste_data.data,
            paste_data.language,
            now,
            edit_key_hash,
            paste_data.burn_after_read,
            expires_at
        )?;
        
        // Set the edit key on the returned paste (only on creation)
        paste.edit_key = Some(edit_key);

        Ok(paste)
    }

    pub fn get_encrypted_paste(&self, id: &str) -> Option<(String, String, DateTime<Utc>)> {
        let conn = self.connection.lock().unwrap();
        
        let mut stmt = conn.prepare("SELECT data, language, created_at, encryption_version FROM pastes WHERE id = ?")
            .ok()?;
            
        stmt.bind((1, id)).ok()?;
        
        if let State::Row = stmt.next().ok()? {
            let data = stmt.read::<String, _>(0).ok()?;
            let language = stmt.read::<String, _>(1).ok()?;
            let created_at = stmt.read::<i64, _>(2).ok()?;
            let encryption_version = stmt.read::<i64, _>(3).ok().unwrap_or(0) as u8;
            
            // Only return the encrypted data for client-side decryption
            if encryption_version == ENCRYPTION_VERSION_CLIENT {
                let timestamp = DateTime::from_timestamp(created_at, 0).unwrap_or_else(|| Utc::now());
                return Some((data, language, timestamp));
            }
        }
        
        None
    }

    pub fn get_paste(&self, id: &str) -> Option<Paste> {
        // First, check if paste exists and get its metadata
        let (encrypted_data, language, created_at, burn_after_read, expires_at) = {
            let conn = self.connection.lock().unwrap();
            let mut stmt = conn.prepare(
                "SELECT data, language, created_at, encryption_version, burn_after_read, expires_at FROM pastes WHERE id = ?"
            ).ok()?;
            
            stmt.bind((1, id)).ok()?;
            
            if let State::Row = stmt.next().ok()? {
                let data = stmt.read::<String, _>(0).ok()?;
                let language = stmt.read::<String, _>(1).ok()?;
                let created_at_ts = stmt.read::<i64, _>(2).ok()?;
                let encryption_version = stmt.read::<i64, _>(3).ok().unwrap_or(0) as u8;
                let burn_after_read = stmt.read::<i64, _>(4).ok().unwrap_or(0) != 0;
                let expires_at: Option<i64> = stmt.read::<Option<i64>, _>(5).ok().flatten();
                
                if encryption_version != ENCRYPTION_VERSION_CLIENT {
                    return None;
                }
                
                let timestamp = DateTime::from_timestamp(created_at_ts, 0).unwrap_or_else(|| Utc::now());
                (data, language, timestamp, burn_after_read, expires_at)
            } else {
                return None;
            }
        };
        
        // Check if paste has expired
        if let Some(exp_ts) = expires_at {
            if Utc::now().timestamp() > exp_ts {
                // Delete expired paste
                self.delete_paste(id);
                return None;
            }
        }
        
        // If burn_after_read is enabled, delete the paste after reading
        if burn_after_read {
            self.delete_paste(id);
        }
        
        Some(Paste {
            id: id.to_string(),
            data: encrypted_data,
            language,
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at: expires_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now())),
            edit_key: None, // Never return edit key on get
            edit_key_hash: None,
        })
    }
    
    pub fn update_paste(&self, id: &str, update_data: UpdatePasteData) -> Result<Paste, DbError> {
        // Check character limit
        let byte_count = Self::get_utf8_byte_count(&update_data.data);
        if byte_count > MAX_PASTE_CHARACTERS {
            return Err(DbError::CharacterLimitExceeded(byte_count, MAX_PASTE_CHARACTERS));
        }
        
        if update_data.data.is_empty() {
            return Err(DbError::ClientEncryptionRequired);
        }
        
        let conn = self.connection.lock().unwrap();
        
        // First, get the stored edit_key_hash and other metadata
        let mut stmt = conn.prepare("SELECT edit_key_hash, created_at, burn_after_read, expires_at FROM pastes WHERE id = ?")?;
        stmt.bind((1, id))?;
        
        let (stored_hash, created_at, burn_after_read, expires_at) = if let State::Row = stmt.next()? {
            let hash: Option<String> = stmt.read::<Option<String>, _>(0).ok().flatten();
            let created_at = stmt.read::<i64, _>(1).unwrap_or(0);
            let burn_after_read = stmt.read::<i64, _>(2).unwrap_or(0) != 0;
            let expires_at_ts = stmt.read::<Option<i64>, _>(3).unwrap_or(None);
            
            let timestamp = DateTime::from_timestamp(created_at, 0).unwrap_or_else(|| Utc::now());
            let expires_at = expires_at_ts.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now()));
            
            match hash {
                Some(h) if !h.is_empty() => (h, timestamp, burn_after_read, expires_at),
                _ => return Err(DbError::InvalidEditKey), // No edit key set for this paste
            }
        } else {
            return Err(DbError::PasteNotFound);
        };
        
        // Verify the edit key
        if !Self::verify_edit_key(&update_data.edit_key, &stored_hash) {
            return Err(DbError::InvalidEditKey);
        }
        
        // Update the paste
        let mut update_stmt = conn.prepare("UPDATE pastes SET data = ?, language = ? WHERE id = ?")?;
        update_stmt.bind((1, update_data.data.as_str()))?;
        update_stmt.bind((2, update_data.language.as_str()))?;
        update_stmt.bind((3, id))?;
        update_stmt.next()?;
        
        Ok(Paste {
            id: id.to_string(),
            data: String::new(),
            language: update_data.language,
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at,
            edit_key: None,
            edit_key_hash: None,
        })
    }

    pub fn delete_paste(&self, id: &str) -> bool {
        let conn = self.connection.lock().unwrap();
        
        // First check if paste exists
        let mut check_stmt = match conn.prepare("SELECT 1 FROM pastes WHERE id = ?") {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        if check_stmt.bind((1, id)).is_err() {
            return false;
        }
        
        let exists = matches!(check_stmt.next(), Ok(State::Row));
        if !exists {
            return false;
        }
        
        // Delete the paste
        let mut stmt = match conn.prepare("DELETE FROM pastes WHERE id = ?") {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        if stmt.bind((1, id)).is_err() {
            return false;
        }
        
        matches!(stmt.next(), Ok(_))
    }
    
    pub fn delete_paste_with_key(&self, id: &str, delete_data: DeletePasteData) -> Result<(), DbError> {
        let conn = self.connection.lock().unwrap();
        
        // First get the stored edit_key_hash
        let mut stmt = conn.prepare("SELECT edit_key_hash FROM pastes WHERE id = ?")?;
        stmt.bind((1, id))?;
        
        if stmt.next()? != State::Row {
            return Err(DbError::PasteNotFound);
        }
        
        let stored_hash: String = stmt.read::<String, _>("edit_key_hash")?;
        
        // Verify the edit key
        if !Self::verify_edit_key(&delete_data.edit_key, &stored_hash) {
            return Err(DbError::InvalidEditKey);
        }
        
        // Delete the paste
        let mut delete_stmt = conn.prepare("DELETE FROM pastes WHERE id = ?")?;
        delete_stmt.bind((1, id))?;
        delete_stmt.next()?;
        
        Ok(())
    }

    pub fn get_dashboard_stats(&self, range: &str) -> Result<DashboardStats, DbError> {
        let conn = self.connection.lock().unwrap();
        
        let total_pastes: i64 = conn
            .prepare("SELECT COUNT(*) FROM pastes")?
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap();

        let pending_expiration: i64 = conn
            .prepare("SELECT COUNT(*) FROM pastes WHERE expires_at IS NOT NULL")?
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap();
            
        let unread_pastes: i64 = conn
            .prepare("SELECT COUNT(*) FROM pastes WHERE burn_after_read = 1")?
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap();

        // Calculate total size (sum of data length)
        let total_size: i64 = conn
            .prepare("SELECT SUM(LENGTH(data)) FROM pastes")?
            .into_iter()
            .map(|row| row.unwrap().read::<Option<i64>, _>(0).unwrap_or(0))
            .next()
            .unwrap_or(0);

        // Calculate language distribution
        let mut language_stats = std::collections::HashMap::new();
        let mut stmt = conn.prepare("SELECT language, COUNT(*) FROM pastes GROUP BY language")?;
        for row in stmt.into_iter() {
            let row = row?;
            let language = row.read::<&str, _>(0).to_string();
            let count = row.read::<i64, _>(1);
            language_stats.insert(language, count);
        }

        // Calculate pastes over time based on range
        let mut pastes_over_time = Vec::new();
        
        let (query, date_format) = match range {
            "24h" => (
                "SELECT strftime('%Y-%m-%d %H:00', datetime(created_at, 'unixepoch')) as date, COUNT(*) as count 
                 FROM pastes 
                 WHERE created_at >= CAST(strftime('%s', 'now', '-24 hours') AS INTEGER)
                 GROUP BY date 
                 ORDER BY date ASC",
                "%Y-%m-%d %H:00"
            ),
            "7d" => (
                "SELECT date(datetime(created_at, 'unixepoch')) as date, COUNT(*) as count 
                 FROM pastes 
                 WHERE created_at >= CAST(strftime('%s', 'now', '-7 days') AS INTEGER)
                 GROUP BY date 
                 ORDER BY date ASC",
                "%Y-%m-%d"
            ),
            "30d" => (
                "SELECT date(datetime(created_at, 'unixepoch')) as date, COUNT(*) as count 
                 FROM pastes 
                 WHERE created_at >= CAST(strftime('%s', 'now', '-30 days') AS INTEGER)
                 GROUP BY date 
                 ORDER BY date ASC",
                "%Y-%m-%d"
            ),
            "1y" => (
                "SELECT strftime('%Y-%m', datetime(created_at, 'unixepoch')) as date, COUNT(*) as count 
                 FROM pastes 
                 WHERE created_at >= CAST(strftime('%s', 'now', '-1 year') AS INTEGER)
                 GROUP BY date 
                 ORDER BY date ASC",
                "%Y-%m"
            ),
            "all" => (
                 "SELECT strftime('%Y-%m', datetime(created_at, 'unixepoch')) as date, COUNT(*) as count 
                 FROM pastes 
                 GROUP BY date 
                 ORDER BY date ASC",
                "%Y-%m"
            ),
            _ => ( // Default to 7d if unknown
                "SELECT date(datetime(created_at, 'unixepoch')) as date, COUNT(*) as count 
                 FROM pastes 
                 WHERE created_at >= CAST(strftime('%s', 'now', '-7 days') AS INTEGER)
                 GROUP BY date 
                 ORDER BY date ASC",
                "%Y-%m-%d"
            ),
        };

        let mut time_stmt = conn.prepare(query)?;
        
        for row in time_stmt.into_iter() {
            let row = row?;
            let date = row.read::<&str, _>(0).to_string();
            let count = row.read::<i64, _>(1);
            pastes_over_time.push(DailyPasteStats { date, count });
        }

        Ok(DashboardStats {
            total_pastes,
            pending_expiration,
            unread_pastes,
            total_size,
            language_stats,
            pastes_over_time,
        })
    }
    
    pub fn list_pastes(&self, limit: i64, offset: i64) -> Result<Vec<Paste>, DbError> {
        let conn = self.connection.lock().unwrap();
        
        let mut stmt = conn.prepare("
            SELECT id, data, language, created_at, encryption_version, burn_after_read, expires_at, edit_key_hash 
            FROM pastes 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ")?;
        
        stmt.bind((1, limit))?;
        stmt.bind((2, offset))?;
        
        let mut pastes = Vec::new();
        
        for row in stmt.into_iter() {
            let row = row?;
            let id = row.read::<&str, _>("id").to_string();
            let data = row.read::<&str, _>("data").to_string();
            let language = row.read::<&str, _>("language").to_string();
            let created_at_ts = row.read::<i64, _>("created_at");
            let encryption_version = row.read::<i64, _>("encryption_version") as u8;
            let burn_after_read = row.read::<i64, _>("burn_after_read") != 0;
            let expires_at_ts = row.read::<Option<i64>, _>("expires_at");
            let edit_key_hash: Option<String> = row.read::<Option<&str>, _>("edit_key_hash").map(|s| s.to_string());
            
            let created_at = DateTime::from_timestamp(created_at_ts, 0).unwrap_or_else(|| Utc::now());
            let expires_at = expires_at_ts.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now()));
            
            pastes.push(Paste {
                id,
                data, // Encrypted data
                language,
                created_at,
                encryption_version,
                burn_after_read,
                expires_at,
                edit_key: None,
                edit_key_hash,
            });
        }
        
        Ok(pastes)
    }

    pub fn delete_paste_admin(&self, id: &str) -> Result<(), DbError> {
        if self.delete_paste(id) {
            Ok(())
        } else {
            Err(DbError::PasteNotFound)
        }
    }
}