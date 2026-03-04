import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runRetrievalProofing } from '../src/context/retrieval/proofing/runner';
import { RetrievalProofingReportSchema } from '../src/context/retrieval/proofing/schema';

const benchmarkPath = resolve(process.cwd(), 'benchmarks/retrieval-proofing/benchmark.v1.json');
const profilesPath = resolve(process.cwd(), 'benchmarks/retrieval-proofing/profiles.v1.json');

describe('retrieval proofing', () => {
  it('produces deterministic scoring for fixed benchmark/profile inputs', async () => {
    const first = await runRetrievalProofing({
      benchmarkPath,
      profilesPath,
      profileName: 'smoke',
    });
    const second = await runRetrievalProofing({
      benchmarkPath,
      profilesPath,
      profileName: 'smoke',
    });

    expect(first.generatedAt).not.toEqual(second.generatedAt);
    expect({ ...first, generatedAt: 'fixed' }).toEqual({ ...second, generatedAt: 'fixed' });
  });

  it('keeps JSON report schema stable and parseable', async () => {
    const report = await runRetrievalProofing({
      benchmarkPath,
      profilesPath,
      profileName: 'smoke',
    });

    const parsed = RetrievalProofingReportSchema.parse(report);

    expect(parsed.schemaVersion).toBe('1.0');
    expect(Object.keys(parsed.strategies)).toEqual(['lexical', 'vector', 'hybrid']);
    expect(parsed.strategies.hybrid.cases.length).toBeGreaterThan(0);
    expect(typeof parsed.gate.passed).toBe('boolean');
  });

  it('reports gate pass/fail based on configured thresholds', async () => {
    const passReport = await runRetrievalProofing({
      benchmarkPath,
      profilesPath,
      profileName: 'smoke',
    });
    expect(passReport.gate.passed).toBe(true);

    const tempDir = await mkdtemp(join(tmpdir(), 'retrieval-proofing-'));
    const strictProfilesPath = join(tempDir, 'profiles.strict.json');
    const baseProfiles = JSON.parse(await readFile(profilesPath, 'utf8')) as {
      version: string;
      profiles: Record<string, unknown>;
    };

    const strictProfiles = {
      ...baseProfiles,
      profiles: {
        ...baseProfiles.profiles,
        smoke: {
          description: 'strict gate for failure test',
          thresholds: {
            hybridMinimums: {
              evidenceRelevance: 0.99,
              citationSupportCoverage: 0.99,
              compositeScore: 0.99,
              maxUnsupportedClaimPenalty: 0.01,
            },
            baselineDeltaFloors: {
              lexical: 0.2,
              vector: 0.2,
            },
          },
        },
      },
    };
    await writeFile(strictProfilesPath, `${JSON.stringify(strictProfiles, null, 2)}\n`, 'utf8');

    const failReport = await runRetrievalProofing({
      benchmarkPath,
      profilesPath: strictProfilesPath,
      profileName: 'smoke',
    });

    expect(failReport.gate.passed).toBe(false);
    expect(failReport.gate.failures.length).toBeGreaterThan(0);
  });
});
