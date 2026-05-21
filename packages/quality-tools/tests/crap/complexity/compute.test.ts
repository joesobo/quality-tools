import { describe, expect, it } from 'vitest';
import { computeComplexity } from '../../../src/crap/complexity/compute';
import { parseArrowFunction } from './astSupport';

describe('computeComplexity', () => {
  it('counts the base complexity for straight-line functions', () => {
    expect(computeComplexity(parseArrowFunction('() => 1'))).toBe(1);
  });

  it('counts conditionals, loops, and logical branches', () => {
    const fn = parseArrowFunction(`() => {
      if (true && false) return 1;
      for (const value of [1, 2]) {
        if (value > 1 || value === 0) return value;
      }
      return 0;
    }`);

    expect(computeComplexity(fn)).toBe(6);
  });
});
