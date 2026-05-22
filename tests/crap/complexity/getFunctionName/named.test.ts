import { describe, expect, it } from 'vitest';
import { getFunctionName } from '../../../../src/crap/complexity/getFunctionName';
import { isTrackedFunctionNode } from '../../../../src/crap/complexity/trackedFunctionNodes';
import { findNodes } from '../astSupport';

describe('getFunctionName named functions', () => {
  it('derives names for declarations, accessors, constructors, and variable functions', () => {
    const names = findNodes(`
      function declared() {}
      const arrow = () => {};
      class Example {
        constructor() {}
        get value() { return 1; }
        set value(next) {}
        method() {}
        field = () => {};
      }
      const objectLiteral = { member: function () { return 1; } };
    `, isTrackedFunctionNode).map(getFunctionName);

    expect(names).toEqual([
      'declared',
      'arrow',
      'constructor',
      'get value',
      'set value',
      'method',
      'field',
      'member'
    ]);
  });
});
