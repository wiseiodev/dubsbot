import { createHash } from 'node:crypto';

export const SemanticEdgeTypes = ['defines', 'references', 'imports', 'calls'] as const;
export type SemanticEdgeType = (typeof SemanticEdgeTypes)[number];

export const GraphNodeTypes = ['file', 'symbol'] as const;
export type GraphNodeType = (typeof GraphNodeTypes)[number];

export const SymbolKinds = [
  'function',
  'class',
  'method',
  'type',
  'constant',
  'module',
  'import',
] as const;
export type SymbolKind = (typeof SymbolKinds)[number];

export type SourceLocation = {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
};

export type ExtractedSymbol = {
  id: string;
  name: string;
  kind: SymbolKind;
  path: string;
  location: SourceLocation;
  diagnostics?: string[];
};

export type GraphSymbolEdge = {
  type: SemanticEdgeType;
  sourceKey: string;
  targetKey: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type GraphFileExtraction = {
  symbols: ExtractedSymbol[];
  edges: GraphSymbolEdge[];
  diagnostics: string[];
};

export function buildCanonicalSymbolId(input: {
  repoRoot: string;
  path: string;
  kind: SymbolKind;
  name: string;
  location: SourceLocation;
}): string {
  const rangeHash = createHash('sha1')
    .update(
      `${input.location.startLine}:${input.location.startColumn}-${input.location.endLine}:${input.location.endColumn}`
    )
    .digest('hex')
    .slice(0, 12);
  return `${input.repoRoot}::${input.path}::${input.kind}::${input.name}::${rangeHash}`;
}
