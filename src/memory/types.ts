export type MemoryKind = 'fact' | 'decision' | 'preference' | 'pattern' | 'system' | 'chunk' | 'conversation' | 'lesson';
export type MemoryTier = 'ephemeral' | 'working' | 'persistent' | 'session';

export interface MemoryNode {
  id: string;
  kind: MemoryKind;
  tier: MemoryTier;
  title: string;
  content: string;
  scope: string;
  importance: number;
  tags: string[];
  links: string[];
  created_at: string;
  updated_at: string;
  access_count: number;
  last_accessed: string;
}

export interface CreateNodeRequest {
  id?: string;
  kind?: MemoryKind;
  tier?: MemoryTier;
  title?: string;
  content: string;
  scope?: string;
  importance?: number;
  tags?: string[];
  links?: string[];
}

export interface SearchQuery {
  query: string;
  top_k?: number;
  profile?: 'balanced' | 'precision' | 'recall' | 'recent';
  scope?: string;
  min_score?: number;
}

export interface SearchResultItem {
  node_id: string;
  score: number;
  title: string;
  content: string;
  kind: MemoryKind;
  tier: MemoryTier;
  bm25_score: number;
  vector_score: number;
  graph_score: number;
  recency_score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  execution_ms: number;
  total_candidates: number;
}

export interface TreeBufferItem {
  node_id: string;
  title: string;
  kind: MemoryKind;
  content_preview: string;
  importance: number;
  added_at: string;
}

export interface TreeBufferResponse {
  scope: string;
  item_count: number;
  max_capacity: number;
  last_updated: string;
  items: TreeBufferItem[];
}

export interface FlushResponse {
  flushed_buffers: number;
  sealed_summaries: string[];
  execution_ms: number;
}

export interface TreeDrilldownResponse {
  root_id: string;
  title: string;
  level: number;
  summary_content: string;
  children: {
    id: string;
    kind: MemoryKind;
    title: string;
    content: string;
    level: number;
  }[];
}

export interface GraphStatsResponse {
  status: string;
  engine_version: string;
  node_count: number;
  edge_count: number;
  unsealed_buffer_count: number;
  obsidian_vault_path: string;
  sqlite_path: string;
  uptime_seconds: number;
}

export interface MemoryEvent {
  event_type: 'node_created' | 'node_updated' | 'buffer_sealed' | 'buffer_flushed';
  node_id?: string;
  scope?: string;
  title?: string;
  timestamp: string;
}

export interface KnowledgeTriple {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  valid_from: number;
  valid_to: number | null;
  confidence: number;
  source: string;
}

export interface DiaryEntry {
  id: string;
  agent_id: string;
  session_id?: string;
  entry_type: string;
  content: string;
  tags?: string[];
  created_at: number;
}

export interface ContextSnapshot {
  snapshot: string;
  node_count: number;
  timestamp: number;
}
