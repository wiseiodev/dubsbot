import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path';

function splitCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function looksLikePathSegment(value: string): boolean {
  if (value.startsWith('-')) {
    return false;
  }
  if (value.includes('*') || value.includes('?')) {
    return false;
  }
  return (
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.includes('/') ||
    value.includes('\\')
  );
}

export function extractCommandTargetPaths(command: string): string[] {
  const tokens = splitCommand(command);
  return tokens.filter(looksLikePathSegment);
}

export function canonicalizeGuardedPath(cwd: string, targetPath: string): string {
  if (targetPath.includes('\0')) {
    throw new Error('Invalid target path');
  }
  const absoluteTarget = isAbsolute(targetPath) ? targetPath : resolve(cwd, targetPath);
  const normalizedAbsoluteTarget = normalize(absoluteTarget);

  if (existsSync(normalizedAbsoluteTarget)) {
    return realpathSync(normalizedAbsoluteTarget);
  }

  let current = dirname(normalizedAbsoluteTarget);
  while (!existsSync(current)) {
    const next = dirname(current);
    if (next === current) {
      throw new Error(`Cannot canonicalize path: ${targetPath}`);
    }
    current = next;
  }

  const canonicalBase = realpathSync(current);
  const relativeSuffix = normalizedAbsoluteTarget.slice(current.length).replace(/^[/\\]+/, '');
  return relativeSuffix.length > 0
    ? normalize(resolve(canonicalBase, relativeSuffix))
    : canonicalBase;
}

function ensureRootBoundary(root: string): string {
  return root.endsWith(sep) ? root : `${root}${sep}`;
}

export function isWithinAllowedRoots(path: string, allowedRoots: string[]): boolean {
  return allowedRoots.some((root) => {
    const canonicalRoot = ensureRootBoundary(root);
    return path === root || path.startsWith(canonicalRoot);
  });
}
