mod db;

use axum::{
    extract::{Path, State},
    http::{Method, Request, StatusCode, HeaderMap, HeaderValue},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use db::{CreatePasteData, Database};
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::net::IpAddr;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

// Define a simple rate limiter for our application
struct AppRateLimiter {
    // Rate limiter for GET requests (most permissive)
    read_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for POST requests (more restrictive)
    create_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for DELETE requests (most restrictive)
    delete_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Limits
    read_limit: u32,
    create_limit: u32,
    delete_limit: u32,
    // Last reset time
    last_reset: Arc<Mutex<Instant>>,
    // Reset interval (1 minute)
    reset_interval: Duration,
}

impl AppRateLimiter {
    fn new(read_limit: u32, create_limit: u32, delete_limit: u32) -> Self {
        Self {
            read_limiter: Arc::new(Mutex::new(HashMap::new())),
            create_limiter: Arc::new(Mutex::new(HashMap::new())),
            delete_limiter: Arc::new(Mutex::new(HashMap::new())),
            read_limit,
            create_limit,
            delete_limit,
            last_reset: Arc::new(Mutex::new(Instant::now())),
            reset_interval: Duration::from_secs(60),
        }
    }
    
    fn check_and_update(&self, ip: &IpAddr, method: &Method) -> Result<u32, u32> {
        // Check if we need to reset counters
        let now = Instant::now();
        let mut last_reset = self.last_reset.lock().unwrap();
        if now.duration_since(*last_reset) >= self.reset_interval {
            // Reset all counters
            self.read_limiter.lock().unwrap().clear();
            self.create_limiter.lock().unwrap().clear();
            self.delete_limiter.lock().unwrap().clear();
            *last_reset = now;
        }
        
        // Choose the appropriate limiter based on the HTTP method
        let (limiter, limit) = match method {
            &Method::GET => (&self.read_limiter, self.read_limit),
            &Method::POST => (&self.create_limiter, self.create_limit),
            &Method::DELETE => (&self.delete_limiter, self.delete_limit),
            _ => (&self.read_limiter, self.read_limit), // Default to read limiter for other methods
        };
        
        // Get the current count for this IP
        let mut map = limiter.lock().unwrap();
        let count = map.entry(*ip).or_insert(0);
        
        // Check if we're over the limit
        if *count >= limit {
            // Calculate remaining time until reset
            let elapsed = now.duration_since(*last_reset);
            let remaining = self.reset_interval.saturating_sub(elapsed).as_secs();
            
            // Return error with remaining time
            Err(remaining as u32)
        } else {
            // Increment the counter
            *count += 1;
            
            // Return remaining requests
            Ok(limit - *count)
        }
    }
    
    fn get_reset_time(&self) -> u32 {
        let now = Instant::now();
        let last_reset = *self.last_reset.lock().unwrap();
        let elapsed = now.duration_since(last_reset);
        self.reset_interval.saturating_sub(elapsed).as_secs() as u32
    }
}

fn add_rate_limit_headers(headers: &mut HeaderMap, remaining: u32, reset_after_secs: u32) {
    headers.insert(
        "x-ratelimit-remaining",
        HeaderValue::from_str(&remaining.to_string()).unwrap(),
    );
    headers.insert(
        "x-ratelimit-reset",
        HeaderValue::from_str(&reset_after_secs.to_string()).unwrap(),
    );
}

// Custom rate limiting middleware
async fn rate_limit(
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Get the client's IP address
    let ip = req
        .extensions()
        .get::<axum::extract::ConnectInfo<SocketAddr>>()
        .map(|connect_info| connect_info.0.ip())
        .unwrap_or_else(|| "0.0.0.0".parse().unwrap());

    // Get the rate limiter from the request extensions
    let rate_limiter = req
        .extensions()
        .get::<Arc<AppRateLimiter>>()
        .expect("Rate limiter not added to request extensions")
        .clone();
    
    // Get the method
    let method = req.method().clone();

    // Check if the request is allowed for this IP
    match rate_limiter.check_and_update(&ip, &method) {
        Ok(remaining) => {
            // Request is allowed, proceed to the next middleware or handler
            let mut response = next.run(req).await;
            
            // Get time until reset
            let reset_after = rate_limiter.get_reset_time();
            
            // Add rate limit headers to the response
            add_rate_limit_headers(response.headers_mut(), remaining, reset_after);
            
            Ok(response)
        }
        Err(reset_after) => {
            // Request is not allowed, return a 429 Too Many Requests response
            let error_message = format!(
                "Rate limit exceeded for IP {}. Try again in {} seconds",
                ip, reset_after
            );
            
            // Create response with rate limit headers
            let mut response = (StatusCode::TOO_MANY_REQUESTS, Json(json_error(&error_message))).into_response();
            
            // Add rate limit headers
            add_rate_limit_headers(response.headers_mut(), 0, reset_after);
            
            Ok(response)
        }
    }
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenv::dotenv().ok();

    // Create database instance
    let db = Arc::new(Database::new());

    // Get port from environment or use default
    let port = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin([
            "https://rustybin.net".parse().unwrap(),
            "http://localhost:8080".parse().unwrap(),
        ])
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(3600));

    // Get rate limit configuration from environment variables or use defaults
    let read_limit = env::var("READ_RATE_LIMIT")
        .unwrap_or_else(|_| "45".to_string())
        .parse::<u32>()
        .unwrap_or(45);
        
    let create_limit = env::var("CREATE_RATE_LIMIT")
        .unwrap_or_else(|_| "15".to_string())
        .parse::<u32>()
        .unwrap_or(15);
        
    let delete_limit = env::var("DELETE_RATE_LIMIT")
        .unwrap_or_else(|_| "15".to_string())
        .parse::<u32>()
        .unwrap_or(15);

    // Create rate limiter
    let rate_limiter = Arc::new(AppRateLimiter::new(
        read_limit,
        create_limit,
        delete_limit
    ));

    // Build our application with routes
    let app = Router::new()
        .route("/api/pastes", post(create_paste))
        .route("/api/pastes/{id}", get(get_paste))
        .route("/api/pastes/{id}", delete(delete_paste))
        .with_state(db.clone())
        .layer(cors)
        .layer(middleware::from_fn_with_state(
            rate_limiter.clone(),
            |State(limiter): State<Arc<AppRateLimiter>>, 
              mut req: Request<axum::body::Body>, 
              next: Next| async move {
                // Add the rate limiter to the request extensions
                req.extensions_mut().insert(limiter);
                rate_limit(req, next).await
            },
        ));

    // Add static file serving for production
    let app = if env::var("RUST_ENV").unwrap_or_default() == "production" {
        app.nest_service("/", ServeDir::new("dist"))
            .fallback(serve_spa)
    } else {
        app
    };

    // Define the address to listen on
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);
    tracing::info!("Rate limiting enabled per IP:");
    tracing::info!("  - Read operations: {} per minute", read_limit);
    tracing::info!("  - Create operations: {} per minute", create_limit);
    tracing::info!("  - Delete operations: {} per minute", delete_limit);

    // Start the server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("Server started successfully");
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await.unwrap();
}

// Handler for creating a new paste
async fn create_paste(
    State(db): State<Arc<Database>>,
    Json(payload): Json<CreatePasteData>,
) -> impl IntoResponse {
    // Validate request
    if payload.data.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json_error("Data is required"))).into_response();
    }

    // Create the paste
    match std::panic::catch_unwind(|| db.create_paste(payload)) {
        Ok(result) => match result {
            Ok(paste) => (StatusCode::CREATED, Json(paste)).into_response(),
            Err(err) => {
                let error_msg = format!("Database error: {}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json_error(&error_msg))).into_response()
            }
        },
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json_error("Failed to create paste")),
        )
            .into_response(),
    }
}

// Handler for getting a paste by ID
async fn get_paste(State(db): State<Arc<Database>>, Path(id): Path<String>) -> impl IntoResponse {
    match db.get_paste(&id) {
        Some(paste) => (StatusCode::OK, Json(paste)).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json_error("Paste not found")),
        )
            .into_response(),
    }
}

// Handler for deleting a paste
async fn delete_paste(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match db.delete_paste(&id) {
        true => StatusCode::NO_CONTENT.into_response(),
        false => (
            StatusCode::NOT_FOUND,
            Json(json_error("Paste not found")),
        )
            .into_response(),
    }
}

// Fallback handler for SPA in production
async fn serve_spa() -> impl IntoResponse {
    (
        StatusCode::OK,
        axum::response::Html(
            std::fs::read_to_string("dist/index.html").unwrap_or_else(|_| {
                "<html><body><h1>Error loading SPA</h1></body></html>".to_string()
            }),
        ),
    )
}

// Helper function to create error JSON responses
fn json_error(message: &str) -> serde_json::Value {
    serde_json::json!({ "error": message })
}
