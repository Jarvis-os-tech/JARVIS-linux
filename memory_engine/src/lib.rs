pub mod config;
pub mod db;
pub mod error;
pub mod repository;
pub mod security;
pub mod types;
pub mod vault;

pub use config::Config;
pub use db::DatabasePool;
pub use error::{MemoryError, Result};
pub use repository::{
    ConversationRepository, EdgeRepository, GraphRepository, NodeRepository,
};
pub use security::{SecretFinding, SecretScanner};
pub use types::*;
pub use vault::{bootstrap_obsidian_vault, VaultFrontmatter, VaultWriter};
