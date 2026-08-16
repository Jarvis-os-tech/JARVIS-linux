pub mod config;
pub mod db;
pub mod error;
pub mod repository;
pub mod search;
pub mod security;
pub mod tree;
pub mod types;
pub mod vault;

pub use config::Config;
pub use db::DatabasePool;
pub use error::{MemoryError, Result};
pub use repository::{
    ConversationRepository, EdgeRepository, GraphRepository, NodeRepository,
};
pub use search::{
    Fts5SearchEngine, GraphSearchEngine, HybridRanker, RecencyScorer, SearchProfile,
    SearchQuery, SearchResult, SignalScores, VectorCandidate, VectorSearchEngine,
};
pub use security::{SecretFinding, SecretScanner};
pub use tree::{
    CascadeSealer, DrillDownNode, Summarizer, SummaryPayload, TreeBuffer,
    TreeBufferRepository, TreeEngine, TreeFlusher, TreeRetrieval,
};
pub use types::*;
pub use vault::{bootstrap_obsidian_vault, VaultFrontmatter, VaultWriter};
