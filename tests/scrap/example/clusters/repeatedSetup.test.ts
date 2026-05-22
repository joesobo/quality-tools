import { describe, expect, it } from 'vitest';
import { isRepeatedSetupExample } from '../../../../src/scrap/example/clusters';
import { example } from './support';

describe('isRepeatedSetupExample', () => {
  it.each([
    ['matching repeated setup', {
      duplicateSetupGroupSize: 2,
      setupLineCount: 2,
      setupFingerprint: 'fp1'
    }, true],
    ['single-example setup', {
      duplicateSetupGroupSize: 1,
      setupLineCount: 2,
      setupFingerprint: 'fp1'
    }, false],
    ['one-line setup', {
      duplicateSetupGroupSize: 2,
      setupLineCount: 1,
      setupFingerprint: 'fp1'
    }, false],
    ['missing fingerprint', {
      duplicateSetupGroupSize: 2,
      setupLineCount: 2,
      setupFingerprint: undefined
    }, false]
  ])('classifies %s', (_caseName, overrides, expected) => {
    expect(isRepeatedSetupExample(example(overrides))).toBe(expected);
  });
});
