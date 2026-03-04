import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { formatProofingMarkdown } from '../../context/retrieval/proofing/reports';
import { runRetrievalProofing } from '../../context/retrieval/proofing/runner';

type RetrievalProofCommandOptions = {
  benchmark: string;
  profiles: string;
  profile: string;
  outputDir: string;
  failOnGate: boolean;
};

export async function runRetrievalProofCommand(
  options: RetrievalProofCommandOptions
): Promise<void> {
  const benchmarkPath = absoluteFromCwd(options.benchmark);
  const profilesPath = absoluteFromCwd(options.profiles);
  const outputDir = absoluteFromCwd(options.outputDir);

  const report = await runRetrievalProofing({
    benchmarkPath,
    profilesPath,
    profileName: options.profile,
  });

  await mkdir(outputDir, { recursive: true });
  const timestamp = report.generatedAt.replaceAll(':', '-');
  const baseName = `${report.profile}-${timestamp}`;
  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, `${formatProofingMarkdown(report)}\n`, 'utf8');

  console.log(`Retrieval proofing complete for profile "${report.profile}".`);
  console.log(`Gate status: ${report.gate.passed ? 'PASS' : 'FAIL'}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${markdownPath}`);

  if (!report.gate.passed && options.failOnGate) {
    throw new Error(`Retrieval proofing gate failed: ${report.gate.failures.join('; ')}`);
  }
}

function absoluteFromCwd(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return resolve(process.cwd(), path);
}
