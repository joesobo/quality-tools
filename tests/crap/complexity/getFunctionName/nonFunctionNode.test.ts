import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { getFunctionName } from '../../../../src/crap/complexity/getFunctionName';
import { firstNode } from '../astSupport';

describe('getFunctionName non-function nodes', () => {
  it('does not derive variable names for non-function nodes', () => {
    const initializer = firstNode('const value = 1;', ts.isNumericLiteral);

    expect(getFunctionName(initializer)).toBe('(anonymous)');
  });
});
