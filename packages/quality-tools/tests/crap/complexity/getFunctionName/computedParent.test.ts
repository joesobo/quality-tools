import { describe, expect, it } from 'vitest';
import { getFunctionName } from '../../../../src/crap/complexity/getFunctionName';
import { isTrackedFunctionNode } from '../../../../src/crap/complexity/trackedFunctionNodes';
import { findNodes } from '../astSupport';

describe('getFunctionName computed parents', () => {
  it('falls back to anonymous for computed or unnamed parents', () => {
    const names = findNodes(`
      const objectLiteral = { ['value']: function () { return 1; } };
      [1].map(() => 1);
    `, isTrackedFunctionNode).map(getFunctionName);

    expect(names).toEqual(['(anonymous)', '(anonymous)']);
  });
});
