CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  command TEXT,
  path TEXT,
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spec JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hooks (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  command TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexes (
  id TEXT PRIMARY KEY,
  repo_root TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  last_indexed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  repo_root TEXT NOT NULL,
  path TEXT NOT NULL,
  hash TEXT NOT NULL,
  language TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repo_root, path)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(file_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS context_nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL,
  node_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS context_edges (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL REFERENCES context_nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES context_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_versions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES context_nodes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_id, version)
);

CREATE TABLE IF NOT EXISTS edge_versions (
  id TEXT PRIMARY KEY,
  edge_id TEXT NOT NULL REFERENCES context_edges(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(edge_id, version)
);

CREATE TABLE IF NOT EXISTS chunk_embeddings (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  embedding JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bm25_documents (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bm25_terms (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES bm25_documents(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  tf INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, term)
);

CREATE TABLE IF NOT EXISTS retrieval_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  query TEXT NOT NULL,
  strategy TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS context_bundle_items (
  id TEXT PRIMARY KEY,
  retrieval_run_id TEXT NOT NULL REFERENCES retrieval_runs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  rank_index INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_runs_session ON tool_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON context_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON context_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_bm25_terms_term ON bm25_terms(term);
