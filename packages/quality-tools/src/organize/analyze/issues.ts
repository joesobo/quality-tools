import { readFileSync } from 'fs';
import { checkLowInfoName, type LowInfoNameConfig } from '../metric/naming/lowInfo';
import { checkBarrelFile } from '../metric/barrel/detection';
import { pathRedundancy } from '../metric/naming/redundancy';
import type { OrganizeFileIssue } from '../model';

/**
 * Collect all file issues (low-info names, barrel files, and path redundancy) for a directory.
 */
export function collectFileIssues(
  fileNames: string[],
  directoryPath: string,
  ancestorFolders: string[],
  lowInfoNames: LowInfoNameConfig,
  redundancyThreshold: number,
  isPackageEntryDirectory = true
): OrganizeFileIssue[] {
  const issues: OrganizeFileIssue[] = [];

  for (const fileName of fileNames) {
    // Check path redundancy
    const score = pathRedundancy(fileName, ancestorFolders);
    if (score >= redundancyThreshold) {
      issues.push({
        fileName,
        kind: 'redundancy',
        detail: `filename repeats path context (${(score * 100).toFixed(0)}% token overlap)`,
        redundancyScore: score
      });
    }

    // Check low-info name
    const lowInfoIssue = checkLowInfoName(fileName, lowInfoNames, isPackageEntryDirectory);
    if (lowInfoIssue) {
      issues.push(lowInfoIssue);
    }

    // Check barrel file
    try {
      const filePath = `${directoryPath}/${fileName}`;
      const fileContent = readFileSync(filePath, 'utf-8');
      const barrelIssue = checkBarrelFile(fileName, fileContent);
      if (barrelIssue) {
        issues.push(barrelIssue);
      }
    } catch {
      // Skip files that cannot be read
    }
  }

  return issues;
}
