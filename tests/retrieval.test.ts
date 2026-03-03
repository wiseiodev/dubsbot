import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  deterministicEmbedding,
  hybridRerank,
} from '../src/context/retrieval/rerank';

describe('retrieval reranking', () => {
  it('produces normalized deterministic embeddings', () => {
    const vec = deterministicEmbedding('hello world', 32);
    expect(vec).toHaveLength(32);
    const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('ranks higher total scores first', () => {
    const ranked = hybridRerank([
      {
        item: 'a',
        lexicalScore: 0.3,
        vectorScore: 0.3,
        graphScore: 0.3,
      },
      {
        item: 'b',
        lexicalScore: 0.9,
        vectorScore: 0.8,
        graphScore: 0.2,
      },
    ]);

    expect(ranked[0].item).toBe('b');
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 10);
  });
});
