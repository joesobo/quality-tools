import { type OrganizeComparison } from '../model';

export function verdictFromDeltas(
  fileFanOutDelta: number,
  folderFanOutDelta: number,
  clusterCountDelta: number,
  issueCountDelta: number,
  redundancyDelta: number
): OrganizeComparison['verdict'] {
  const deltas = [fileFanOutDelta, folderFanOutDelta, clusterCountDelta, issueCountDelta, redundancyDelta];
  let direction = 0;

  for (const delta of deltas) {
    const nextDirection = Math.sign(delta);
    if (nextDirection === 0) {
      continue;
    }
    if (direction === 0) {
      direction = nextDirection;
      continue;
    }
    if (direction !== nextDirection) {
      return 'mixed';
    }
  }

  if (direction < 0) {
    return 'improved';
  }
  if (direction > 0) {
    return 'worse';
  }
  return 'unchanged';
}
