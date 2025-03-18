use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use rand::{distributions::Alphanumeric, Rng};
use sqlite::{Connection, State};
use std::fs;
use thiserror::Error;

// Define the Paste struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paste {
    pub id: String,
    pub data: String,
    pub language: String,
    pub created_at: DateTime<Utc>,
    pub encryption_version: u8,
}

// Data structure for creating a new paste
#[derive(Debug, Deserialize)]
pub struct CreatePasteData {
    pub data: String,
    pub language: String,
}

// Database error type
#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] sqlite::Error),
    
    // #[error("Encryption error: {0}")]
    // Encryption(String),
    
    // #[error("Decryption error: {0}")]
    // Decryption(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Client-side encryption required")]
    ClientEncryptionRequired,
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

// Encryption version constants
const ENCRYPTION_VERSION_CLIENT: u8 = 1;

impl Database {
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
        
        // Create tables if they don't exist
        connection.execute("
            CREATE TABLE IF NOT EXISTS pastes (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                language TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                encryption_version INTEGER NOT NULL DEFAULT 0
            );
        ").expect("Failed to create pastes table");
        
        connection.execute("
            CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON pastes(created_at DESC);
        ").expect("Failed to create index");
        
        Self {
            connection: Arc::new(Mutex::new(connection)),
        }
    }
    
    // Store client-encrypted paste
    pub fn store_client_encrypted_paste(&self, id: String, data: String, language: String, created_at: DateTime<Utc>) -> Paste {
        let timestamp = created_at.timestamp() as i64;
        
        // Insert into database
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("INSERT INTO pastes (id, data, language, created_at, encryption_version) VALUES (?, ?, ?, ?, ?)")
            .unwrap();
        
        // Bind parameters
        stmt.bind((1, id.as_str())).unwrap();
        stmt.bind((2, data.as_str())).unwrap();
        stmt.bind((3, language.as_str())).unwrap();
        stmt.bind((4, timestamp.to_string().as_str())).unwrap();
        stmt.bind((5, ENCRYPTION_VERSION_CLIENT.to_string().as_str())).unwrap();
        
        stmt.next().expect("Failed to insert paste");

        // Return a placeholder paste object with minimal information
        Paste {
            id,
            data,
            language,
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
        }
    }

    pub fn create_paste(&self, paste_data: CreatePasteData) -> Result<Paste, DbError> {
        let id: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(6)
        .map(char::from)
        .collect();

        let now = Utc::now();
        
        if !paste_data.data.is_empty() {
            // Store the client-encrypted paste
            let paste = self.store_client_encrypted_paste(
                id,
                paste_data.data,
                paste_data.language,
                now
            );

            return Ok(paste);
        }
        
        // If we reach here, client didn't provide encrypted content
        Err(DbError::ClientEncryptionRequired)
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
        if let Some((encrypted_data, language, created_at)) = self.get_encrypted_paste(id) {
            Some(Paste {
                id: id.to_string(),
                data: encrypted_data,
                language,
                created_at,
                encryption_version: ENCRYPTION_VERSION_CLIENT,
            })
        } else {
            None
        }
    }

    pub fn delete_paste(&self, id: &str) -> bool {
        let conn = self.connection.lock().unwrap();
        
        let mut stmt = conn.prepare("DELETE FROM pastes WHERE id = ?").unwrap();
        stmt.bind((1, id)).ok();
        let result = stmt.next();
        
        // Check if the operation was successful
        match result {
            Ok(_) => true,
            Err(_) => false,
        }
    }
} 