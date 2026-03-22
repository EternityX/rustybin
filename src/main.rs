mod db;
mod error;
mod handlers;
mod health;
mod models;

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, HeaderValue, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
};
use db::Database;
use std::collections::HashMap;
use std::env;
use std::net::IpAddr;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use error::json_error;
use handlers::paste::{create_paste, delete_paste, get_paste, update_paste};
use handlers::workspace::{create_workspace, delete_workspace, get_workspace, update_workspace};
use health::HealthChecker;

// Define a simple rate limiter for our application
struct AppRateLimiter {
    // Rate limiter for GET requests (most permissive)
    read_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for POST requests (more restrictive)
    create_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for DELETE requests (most restrictive)
    delete_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for PUT requests (same as create)
    update_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Limits
    read_limit: u32,
    create_limit: u32,
    delete_limit: u32,
    update_limit: u32,
    // Last reset time
    last_reset: Arc<Mutex<Instant>>,
    // Reset interval (1 minute)
    reset_interval: Duration,
}

impl AppRateLimiter {
    fn new(read_limit: u32, create_limit: u32, delete_limit: u32, update_limit: u32) -> Self {
        Self {
            read_limiter: Arc::new(Mutex::new(HashMap::new())),
            create_limiter: Arc::new(Mutex::new(HashMap::new())),
            delete_limiter: Arc::new(Mutex::new(HashMap::new())),
            update_limiter: Arc::new(Mutex::new(HashMap::new())),
            read_limit,
            create_limit,
            delete_limit,
            update_limit,
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
            self.update_limiter.lock().unwrap().clear();
            *last_reset = now;
        }

        // Choose the appropriate limiter based on the HTTP method
        let (limiter, limit) = match method {
            &Method::GET => (&self.read_limiter, self.read_limit),
            &Method::POST => (&self.create_limiter, self.create_limit),
            &Method::DELETE => (&self.delete_limiter, self.delete_limit),
            &Method::PUT => (&self.update_limiter, self.update_limit),
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
async fn rate_limit(req: Request<axum::body::Body>, next: Next) -> Result<Response, StatusCode> {
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
            // Track server errors for health monitoring
            let health_checker = req.extensions().get::<Arc<HealthChecker>>().cloned();

            // Request is allowed, proceed to the next middleware or handler
            let mut response = next.run(req).await;

            // Record DB/server errors
            if response.status().is_server_error() {
                if let Some(hc) = health_checker {
                    hc.record_db_error();
                }
            }

            // Get time until reset
            let reset_after = rate_limiter.get_reset_time();

            // Add rate limit headers to the response
            add_rate_limit_headers(response.headers_mut(), remaining, reset_after);

            Ok(response)
        }
        Err(reset_after) => {
            // Request is not allowed, return a 429 Too Many Requests response
            let error_message =
                format!("Rate limit exceeded. Try again in {} seconds", reset_after);

            // Create response with rate limit headers
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json_error(&error_message)),
            )
                .into_response();

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

    // Create health checker
    let health_checker = Arc::new(HealthChecker::new("data/pastes.db".to_string()));

    // Get port from environment or use default
    let port = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");

    // Get allowed origins from environment variable or use defaults
    let allowed_origins_str = env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "https://rustybin.net,https://rustyb.in,http://localhost:8080,https://api.rustybin.net,https://api.rustyb.in".to_string());

    let allowed_origins: Vec<axum::http::HeaderValue> = allowed_origins_str
        .split(',')
        .map(|origin| {
            origin
                .trim()
                .parse()
                .expect(&format!("Invalid origin URL: {}", origin))
        })
        .collect();

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
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

    let update_limit = env::var("UPDATE_RATE_LIMIT")
        .unwrap_or_else(|_| "15".to_string())
        .parse::<u32>()
        .unwrap_or(15);

    // Create rate limiter
    let rate_limiter = Arc::new(AppRateLimiter::new(
        read_limit,
        create_limit,
        delete_limit,
        update_limit,
    ));

    // Build our application with routes
    let config_state = Arc::new(ConfigInfo {
        read_limit,
        create_limit,
        update_limit,
        delete_limit,
        reset_interval_secs: 60,
    });

    let app = Router::new()
        .route(
            "/v1/health",
            get({
                let hc = health_checker.clone();
                move || health_check(hc)
            }),
        )
        .route(
            "/v1/config",
            get({
                let config = config_state.clone();
                move || get_config(config)
            }),
        )
        .route("/v1/pastes", post(create_paste))
        .route("/v1/pastes/{id}", get(get_paste))
        .route("/v1/pastes/{id}", put(update_paste))
        .route("/v1/pastes/{id}", delete(delete_paste))
        .route("/v1/workspaces", post(create_workspace))
        .route("/v1/workspaces/{id}", get(get_workspace))
        .route("/v1/workspaces/{id}", put(update_workspace))
        .route("/v1/workspaces/{id}", delete(delete_workspace))
        .with_state(db.clone())
        .layer(middleware::from_fn_with_state(
            (rate_limiter.clone(), health_checker.clone()),
            |State((limiter, hc)): State<(Arc<AppRateLimiter>, Arc<HealthChecker>)>,
             mut req: Request<axum::body::Body>,
             next: Next| async move {
                req.extensions_mut().insert(limiter);
                req.extensions_mut().insert(hc);
                rate_limit(req, next).await
            },
        ))
        .layer(cors);

    // Add static file serving for production
    let app = if env::var("RUST_ENV").unwrap_or_default() == "production" {
        app.fallback_service(ServeDir::new("dist").fallback(axum::routing::get(serve_spa)))
    } else {
        app
    };

    // Define the address to listen on
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);
    tracing::info!("CORS allowed origins: {}", allowed_origins_str);
    tracing::info!("Rate limiting enabled per IP:");
    tracing::info!("  - Read operations: {} per minute", read_limit);
    tracing::info!("  - Create operations: {} per minute", create_limit);
    tracing::info!("  - Update operations: {} per minute", update_limit);
    tracing::info!("  - Delete operations: {} per minute", delete_limit);

    // Start the server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("Server started successfully");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

// Config info shared with frontend
struct ConfigInfo {
    read_limit: u32,
    create_limit: u32,
    update_limit: u32,
    delete_limit: u32,
    reset_interval_secs: u32,
}

// Health check endpoint
// only expose status, log details server-side
async fn health_check(health_checker: Arc<HealthChecker>) -> impl IntoResponse {
    let health = health_checker.check();
    let status_code = match health.status {
        "ok" => StatusCode::OK,
        "degraded" => StatusCode::OK,
        _ => StatusCode::SERVICE_UNAVAILABLE,
    };
    if health.status != "ok" {
        tracing::warn!(
            "Health check: {} (disk: {} {}, cpu: {} {}, db: {} {})",
            health.status,
            health.checks.disk.status,
            health.checks.disk.message.as_deref().unwrap_or(""),
            health.checks.cpu.status,
            health.checks.cpu.message.as_deref().unwrap_or(""),
            health.checks.database.status,
            health.checks.database.message.as_deref().unwrap_or(""),
        );
    }
    (
        status_code,
        Json(serde_json::json!({ "status": health.status })),
    )
}

// Config endpoint - exposes rate limits
async fn get_config(config: Arc<ConfigInfo>) -> impl IntoResponse {
    Json(serde_json::json!({
        "rate_limits": {
            "reset_interval_secs": config.reset_interval_secs,
            "read": config.read_limit,
            "create": config.create_limit,
            "update": config.update_limit,
            "delete": config.delete_limit,
        }
    }))
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
