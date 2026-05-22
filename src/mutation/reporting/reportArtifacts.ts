import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { relativeReportPath } from '../../config/quality';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';

export function rootReportDirectory(repoRoot = REPO_ROOT): string {
  return relativeReportPath(repoRoot, 'mutation');
}

export function reportDirectory(reportKey: string, repoRoot = REPO_ROOT): string {
  return `${rootReportDirectory(repoRoot)}/${reportKey}`;
}

export function incrementalReportPath(reportKey: string, repoRoot = REPO_ROOT): string {
  return `${reportDirectory(reportKey, repoRoot)}/stryker-incremental-${reportKey}.json`;
}

export function copySharedMutationReports(reportKey: string, repoRoot = process.cwd()): string {
  const targetDirectory = join(repoRoot, reportDirectory(reportKey, repoRoot));
  mkdirSync(targetDirectory, { recursive: true });

  const sharedJson = join(repoRoot, rootReportDirectory(repoRoot), 'mutation.json');
  const sharedHtml = join(repoRoot, rootReportDirectory(repoRoot), 'mutation.html');
  const targetIncremental = join(repoRoot, incrementalReportPath(reportKey, repoRoot));

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
