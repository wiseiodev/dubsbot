ALTER TABLE context_nodes
DROP CONSTRAINT IF EXISTS context_nodes_node_type_check;

ALTER TABLE context_nodes
ADD CONSTRAINT context_nodes_node_type_check
CHECK (node_type IN ('file', 'symbol'));

ALTER TABLE context_edges
DROP CONSTRAINT IF EXISTS context_edges_edge_type_check;

ALTER TABLE context_edges
ADD CONSTRAINT context_edges_edge_type_check
CHECK (edge_type IN ('defines', 'references', 'imports', 'calls'));

CREATE INDEX IF NOT EXISTS idx_context_nodes_node_type ON context_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_context_nodes_node_key ON context_nodes(node_key);
CREATE INDEX IF NOT EXISTS idx_context_edges_edge_type ON context_edges(edge_type);
