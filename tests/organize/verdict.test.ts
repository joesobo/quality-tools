import { describe, expect, it } from 'vitest';
import { verdictFromDeltas } from '../../src/organize/compare/verdict';

describe('verdictFromDeltas', () => {
  it.each([
    [0, 0, 0, 0, 0, 'unchanged'],
    [-1, 0, 0, 0, 0, 'improved'],
    [0, -1, 0, 0, -0.1, 'improved'],
    [1, 0, 0, 0, 0, 'worse'],
    [0, 1, 0, 0, 0.1, 'worse'],
    [1, -1, 0, 0, 0, 'mixed'],
    [0, 0, 1, -1, 0, 'mixed']
  ] as const)('returns %s for deltas [%s, %s, %s, %s, %s]', (fileFanOutDelta, folderFanOutDelta, clusterCountDelta, issueCountDelta, redundancyDelta, expected) => {
    expect(verdictFromDeltas(fileFanOutDelta, folderFanOutDelta, clusterCountDelta, issueCountDelta, redundancyDelta)).toBe(expected);
  });
});
