// Models are defined in db.rs since they're tightly coupled to the database layer.
// This module provides re-exports for cleaner imports.
pub use crate::db::{Paste, CreatePasteData, UpdatePasteData, DeletePasteData};

pub mod workspace;
pub use workspace::*;
