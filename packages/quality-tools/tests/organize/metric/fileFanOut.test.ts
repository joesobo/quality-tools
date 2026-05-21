import { describe, expect, it } from 'vitest';
import { fileFanOutVerdict } from '../../../src/organize/metric/fileFanOut';

describe('fileFanOutVerdict', () => {
  it.each([
    [5, 8, 10, 'STABLE'],
    [0, 8, 10, 'STABLE'],
    [7, 8, 10, 'STABLE'],
    [8, 8, 10, 'WARNING'],
    [9, 8, 10, 'WARNING'],
    [10, 8, 10, 'SPLIT'],
    [11, 8, 10, 'SPLIT'],
    [100, 8, 10, 'SPLIT'],
    [19, 20, 30, 'STABLE'],
    [20, 20, 30, 'WARNING'],
    [29, 20, 30, 'WARNING'],
    [30, 20, 30, 'SPLIT'],
    [4, 5, 6, 'STABLE'],
    [5, 5, 6, 'WARNING'],
    [6, 5, 6, 'SPLIT'],
    [1000, 8, 10, 'SPLIT']
  ] as const)('returns %s for count=%s warning=%s split=%s', (count, warning, split, expected) => {
    expect(fileFanOutVerdict(count, warning, split)).toBe(expected);
  });
});
