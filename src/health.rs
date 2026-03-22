use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use sysinfo::{Disks, System};

const DB_ERROR_WINDOW_SECS: u64 = 60;
const DB_ERROR_THRESHOLD: u64 = 10;
const DISK_FREE_THRESHOLD_MB: u64 = 100;
const CPU_USAGE_THRESHOLD: f32 = 95.0;

#[derive(Clone)]
pub struct HealthChecker {
    db_errors: Arc<Mutex<Vec<Instant>>>,
    db_error_count: Arc<AtomicU64>,
    db_path: String,
}

#[derive(Debug, serde::Serialize)]
pub struct HealthStatus {
    pub status: &'static str,
    pub checks: HealthChecks,
}

#[derive(Debug, serde::Serialize)]
pub struct HealthChecks {
    pub disk: CheckResult,
    pub cpu: CheckResult,
    pub database: CheckResult,
}

#[derive(Debug, serde::Serialize)]
pub struct CheckResult {
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl CheckResult {
    fn ok() -> Self {
        Self {
            status: "ok",
            message: None,
        }
    }

    fn degraded(message: String) -> Self {
        Self {
            status: "degraded",
            message: Some(message),
        }
    }

    fn unhealthy(message: String) -> Self {
        Self {
            status: "unhealthy",
            message: Some(message),
        }
    }

    fn is_ok(&self) -> bool {
        self.status == "ok"
    }

    fn is_unhealthy(&self) -> bool {
        self.status == "unhealthy"
    }
}

impl HealthChecker {
    pub fn new(db_path: String) -> Self {
        Self {
            db_errors: Arc::new(Mutex::new(Vec::new())),
            db_error_count: Arc::new(AtomicU64::new(0)),
            db_path,
        }
    }

    pub fn record_db_error(&self) {
        let now = Instant::now();
        let mut errors = self.db_errors.lock().unwrap();
        errors.push(now);
        self.db_error_count.fetch_add(1, Ordering::Relaxed);
    }

    fn recent_db_errors(&self) -> u64 {
        let now = Instant::now();
        let window = Duration::from_secs(DB_ERROR_WINDOW_SECS);
        let mut errors = self.db_errors.lock().unwrap();
        errors.retain(|t| now.duration_since(*t) < window);
        errors.len() as u64
    }

    fn check_disk(&self) -> CheckResult {
        let disks = Disks::new_with_refreshed_list();

        // Find the disk that contains our DB path
        let target_disk = disks
            .iter()
            .find(|d| {
                self.db_path
                    .starts_with(&d.mount_point().to_string_lossy().to_string())
            })
            .or_else(|| disks.iter().next());

        match target_disk {
            Some(disk) => {
                let free_mb = disk.available_space() / (1024 * 1024);
                let total_mb = disk.total_space() / (1024 * 1024);
                let free_pct = if total_mb > 0 {
                    (free_mb as f64 / total_mb as f64) * 100.0
                } else {
                    0.0
                };

                if free_mb < DISK_FREE_THRESHOLD_MB {
                    CheckResult::unhealthy(format!(
                        "{}MB free ({}% of {}MB)",
                        free_mb, free_pct as u64, total_mb
                    ))
                } else if free_pct < 10.0 {
                    CheckResult::degraded(format!(
                        "{}MB free ({:.1}% of {}MB)",
                        free_mb, free_pct, total_mb
                    ))
                } else {
                    CheckResult::ok()
                }
            }
            None => CheckResult::degraded("Could not read disk info".to_string()),
        }
    }

    fn check_cpu(&self) -> CheckResult {
        let mut sys = System::new();
        sys.refresh_cpu_all();
        // sysinfo needs a short delay between refreshes for accurate readings
        std::thread::sleep(Duration::from_millis(200));
        sys.refresh_cpu_all();

        let cpu_usage = sys.global_cpu_usage();
        // let cpu_usage = 85.0;
        // let cpu_usage = 96.0;

        if cpu_usage >= CPU_USAGE_THRESHOLD {
            CheckResult::unhealthy(format!("{:.1}% usage", cpu_usage))
        } else if cpu_usage >= 85.0 {
            CheckResult::degraded(format!("{:.1}% usage", cpu_usage))
        } else {
            CheckResult::ok()
        }
    }

    fn check_database(&self) -> CheckResult {
        let recent = self.recent_db_errors();
        let total = self.db_error_count.load(Ordering::Relaxed);

        if recent >= DB_ERROR_THRESHOLD {
            CheckResult::unhealthy(format!(
                "{} errors in last {}s ({} total)",
                recent, DB_ERROR_WINDOW_SECS, total
            ))
        } else if recent > 0 {
            CheckResult::degraded(format!(
                "{} errors in last {}s ({} total)",
                recent, DB_ERROR_WINDOW_SECS, total
            ))
        } else {
            CheckResult::ok()
        }
    }

    pub fn check(&self) -> HealthStatus {
        let disk = self.check_disk();
        let cpu = self.check_cpu();
        let database = self.check_database();

        let status = if disk.is_unhealthy() || cpu.is_unhealthy() || database.is_unhealthy() {
            "unhealthy"
        } else if !disk.is_ok() || !cpu.is_ok() || !database.is_ok() {
            "degraded"
        } else {
            "ok"
        };

        HealthStatus {
            status,
            checks: HealthChecks {
                disk,
                cpu,
                database,
            },
        }
    }
}
