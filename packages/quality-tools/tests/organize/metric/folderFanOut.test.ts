import { describe, expect, it } from 'vitest';
import { folderFanOutVerdict } from '../../../src/organize/metric/folderFanOut';

describe('folderFanOutVerdict', () => {
  it.each([
    [5, 10, 13, 'STABLE'],
    [0, 10, 13, 'STABLE'],
    [9, 10, 13, 'STABLE'],
    [10, 10, 13, 'WARNING'],
    [11, 10, 13, 'WARNING'],
    [12, 10, 13, 'WARNING'],
    [13, 10, 13, 'SPLIT'],
    [14, 10, 13, 'SPLIT'],
    [100, 10, 13, 'SPLIT'],
    [14, 15, 25, 'STABLE'],
    [15, 15, 25, 'WARNING'],
    [24, 15, 25, 'WARNING'],
    [25, 15, 25, 'SPLIT'],
    [6, 7, 8, 'STABLE'],
    [7, 7, 8, 'WARNING'],
    [8, 7, 8, 'SPLIT'],
    [1000, 10, 13, 'SPLIT']
  ] as const)('returns %s for count=%s warning=%s split=%s', (count, warning, split, expected) => {
    expect(folderFanOutVerdict(count, warning, split)).toBe(expected);
  });
});
