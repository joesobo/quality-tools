import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { resolveReportPath } from '../config/quality';
import { sanitizeReportKey } from '../shared/util/reportKey';
import { REPO_ROOT } from '../shared/resolve/repoRoot';
import { type ScrapFileMetric } from './model';

export function baselinePathFor(targetRelativePath: string): string {
  const reportKey = sanitizeReportKey(targetRelativePath === '.' ? 'repo' : targetRelativePath);
  return resolveReportPath(REPO_ROOT, 'scrap', `${reportKey}.json`);
}

export function baseline(
  targetRelativePath: string,
  metrics: ScrapFileMetric[]
): void {
  const baselinePath = baselinePathFor(targetRelativePath);
  mkdirSync(join(baselinePath, '..'), { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(metrics, null, 2));
}
