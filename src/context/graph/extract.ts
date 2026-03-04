import { posix } from 'node:path';
import { buildCanonicalSymbolId, type ExtractedSymbol, type GraphFileExtraction } from './types';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export function canExtractSymbols(path: string): boolean {
  const normalized = path.toLowerCase();
  for (const extension of SUPPORTED_EXTENSIONS) {
    if (normalized.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

export function extractGraphDataForFile(input: {
  repoRoot: string;
  path: string;
  content: string;
}): GraphFileExtraction {
  const normalizedPath = posix.normalize(input.path);
  if (!canExtractSymbols(normalizedPath)) {
    return {
      symbols: [],
      edges: [],
      diagnostics: [`unsupported-language:${normalizedPath}`],
    };
  }

  const symbols: ExtractedSymbol[] = [];
  const edges: GraphFileExtraction['edges'] = [];
  const diagnostics: string[] = [];
  const lines = input.content.split('\n');
  const symbolByName = new Map<string, ExtractedSymbol>();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const functionMatch = line.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (functionMatch) {
      const symbol = makeSymbol({
        repoRoot: input.repoRoot,
        path: normalizedPath,
        name: functionMatch[1],
        kind: 'function',
        line,
        lineNumber,
      });
      addSymbol(symbols, symbolByName, symbol);
      continue;
    }

    const classMatch = line.match(/\bclass\s+([A-Za-z_$][\w$]*)\b/);
    if (classMatch) {
      const symbol = makeSymbol({
        repoRoot: input.repoRoot,
        path: normalizedPath,
        name: classMatch[1],
        kind: 'class',
        line,
        lineNumber,
      });
      addSymbol(symbols, symbolByName, symbol);
      continue;
    }

    const typeMatch = line.match(/\b(?:interface|type)\s+([A-Za-z_$][\w$]*)\b/);
    if (typeMatch) {
      const symbol = makeSymbol({
        repoRoot: input.repoRoot,
        path: normalizedPath,
        name: typeMatch[1],
        kind: 'type',
        line,
        lineNumber,
      });
      addSymbol(symbols, symbolByName, symbol);
      continue;
    }

    const constantMatch = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/);
    if (constantMatch) {
      const symbol = makeSymbol({
        repoRoot: input.repoRoot,
        path: normalizedPath,
        name: constantMatch[1],
        kind: 'constant',
        line,
        lineNumber,
      });
      addSymbol(symbols, symbolByName, symbol);
      continue;
    }

    const importMatch = line.match(/\bimport\s+(.+)\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const moduleName = importMatch[2];
      const moduleSymbol = makeSymbol({
        repoRoot: input.repoRoot,
        path: normalizedPath,
        name: `module:${moduleName}`,
        kind: 'module',
        line,
        lineNumber,
      });
      addSymbol(symbols, symbolByName, moduleSymbol);

      const importedPart = importMatch[1];
      const names = importedPart
        .replace(/[{}]/g, ' ')
        .split(',')
        .map((entry) => entry.trim())
        .map((entry) => entry.split(/\s+as\s+/i).at(-1) ?? entry)
        .map((entry) => entry.trim())
        .filter(Boolean);
      for (const name of names) {
        const importSymbol = makeSymbol({
          repoRoot: input.repoRoot,
          path: normalizedPath,
          name,
          kind: 'import',
          line,
          lineNumber,
        });
        addSymbol(symbols, symbolByName, importSymbol);
        edges.push({
          type: 'imports',
          sourceKey: fileNodeKey(input.repoRoot, normalizedPath),
          targetKey: importSymbol.id,
          confidence: 1,
          metadata: { module: moduleName },
        });
      }
    }
  }

  for (const symbol of symbols) {
    edges.push({
      type: 'defines',
      sourceKey: fileNodeKey(input.repoRoot, normalizedPath),
      targetKey: symbol.id,
      confidence: 1,
    });
  }

  const knownNames = [...symbolByName.keys()];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;
    for (const match of line.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const callee = match[1];
      const target = symbolByName.get(callee);
      if (!target) {
        continue;
      }
      edges.push({
        type: 'calls',
        sourceKey: fileNodeKey(input.repoRoot, normalizedPath),
        targetKey: target.id,
        confidence: 0.7,
        metadata: { line: lineNumber },
      });
    }

    for (const name of knownNames) {
      if (!line.includes(name)) {
        continue;
      }
      const target = symbolByName.get(name);
      if (!target) {
        continue;
      }
      edges.push({
        type: 'references',
        sourceKey: fileNodeKey(input.repoRoot, normalizedPath),
        targetKey: target.id,
        confidence: 0.5,
        metadata: { line: lineNumber },
      });
    }
  }

  if (symbols.length === 0) {
    diagnostics.push(`no-symbols-detected:${normalizedPath}`);
  }

  return {
    symbols,
    edges: dedupeEdges(edges),
    diagnostics,
  };
}

function addSymbol(
  symbols: ExtractedSymbol[],
  symbolByName: Map<string, ExtractedSymbol>,
  symbol: ExtractedSymbol
): void {
  if (symbolByName.has(symbol.name)) {
    return;
  }
  symbols.push(symbol);
  symbolByName.set(symbol.name, symbol);
}

function makeSymbol(input: {
  repoRoot: string;
  path: string;
  name: string;
  kind: ExtractedSymbol['kind'];
  line: string;
  lineNumber: number;
}): ExtractedSymbol {
  const startColumn = Math.max(input.line.indexOf(input.name), 0) + 1;
  const endColumn = startColumn + input.name.length;
  const location = {
    startLine: input.lineNumber,
    endLine: input.lineNumber,
    startColumn,
    endColumn,
  };
  return {
    id: buildCanonicalSymbolId({
      repoRoot: input.repoRoot,
      path: input.path,
      kind: input.kind,
      name: input.name,
      location,
    }),
    name: input.name,
    kind: input.kind,
    path: input.path,
    location,
  };
}

function fileNodeKey(repoRoot: string, path: string): string {
  return `${repoRoot}::${path}::file`;
}

function dedupeEdges(edges: GraphFileExtraction['edges']): GraphFileExtraction['edges'] {
  const map = new Map<string, GraphFileExtraction['edges'][number]>();
  for (const edge of edges) {
    const key = `${edge.type}|${edge.sourceKey}|${edge.targetKey}`;
    if (!map.has(key)) {
      map.set(key, edge);
    }
  }
  return [...map.values()];
}
