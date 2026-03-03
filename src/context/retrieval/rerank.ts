export function deterministicEmbedding(text: string, dim = 64): number[] {
  const vector = new Array<number>(dim).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    vector[i % dim] += (code % 97) / 97;
  }

  const norm = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 0;
  }

  return dot / denom;
}

export type RankedItem<T> = {
  item: T;
  lexicalScore: number;
  vectorScore: number;
  graphScore: number;
};

export function hybridRerank<T>(
  items: RankedItem<T>[]
): Array<RankedItem<T> & { totalScore: number }> {
  return items
    .map((entry) => ({
      ...entry,
      totalScore: entry.lexicalScore * 0.4 + entry.vectorScore * 0.4 + entry.graphScore * 0.2,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}
