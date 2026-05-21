import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function rootReportDirectory(): string {
  return 'reports/mutation';
}

export function reportDirectory(reportKey: string): string {
  return `${rootReportDirectory()}/${reportKey}`;
}

export function incrementalReportPath(reportKey: string): string {
  return `${reportDirectory(reportKey)}/stryker-incremental-${reportKey}.json`;
}

export function copySharedMutationReports(reportKey: string, repoRoot = process.cwd()): string {
  const targetDirectory = join(repoRoot, reportDirectory(reportKey));
  mkdirSync(targetDirectory, { recursive: true });

  const sharedJson = join(repoRoot, rootReportDirectory(), 'mutation.json');
  const sharedHtml = join(repoRoot, rootReportDirectory(), 'mutation.html');
  const targetIncremental = join(repoRoot, incrementalReportPath(reportKey));

  if (existsSync(sharedJson)) {
    cpSync(sharedJson, `${targetDirectory}/mutation.json`);
  }

  if (existsSync(sharedHtml)) {
    cpSync(sharedHtml, `${targetDirectory}/mutation.html`);
  }

  if (!existsSync(targetIncremental) && existsSync(sharedJson)) {
    cpSync(sharedJson, targetIncremental);
  }

  return join(targetDirectory, 'mutation.json');
}
