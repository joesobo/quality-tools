import { type OrganizeVerdict } from '../model';

export function folderFanOutVerdict(
  folderCount: number,
  warningThreshold: number,
  splitThreshold: number
): OrganizeVerdict {
  if (folderCount >= splitThreshold) {
    return 'SPLIT';
  }

  if (folderCount >= warningThreshold) {
    return 'WARNING';
  }

  return 'STABLE';
}
