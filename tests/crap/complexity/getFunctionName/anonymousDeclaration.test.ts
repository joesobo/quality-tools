import { describe, expect, it } from 'vitest';
import { getFunctionName } from '../../../../src/crap/complexity/getFunctionName';
import { isTrackedFunctionNode } from '../../../../src/crap/complexity/trackedFunctionNodes';
import { findNodes } from '../astSupport';

describe('getFunctionName anonymous declarations', () => {
  it('falls back to anonymous names when no declaration name exists', () => {
    const [anonymous] = findNodes(`export default function () {};`, isTrackedFunctionNode);

    expect(getFunctionName(anonymous!)).toBe('(anonymous)');
  });
});
