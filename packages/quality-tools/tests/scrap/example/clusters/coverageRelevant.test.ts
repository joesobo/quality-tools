import { describe, expect, it } from 'vitest';
import { coverageRelevantExamples } from '../../../../src/scrap/example/clusters';
import { example } from './support';

describe('coverageRelevantExamples', () => {
  it('keeps table-driven, literal-shaped, and fixture-shaped examples', () => {
    const result = coverageRelevantExamples([
      example({ name: 'table', tableDriven: true }),
      example({ name: 'literal', literalShapeFingerprint: 'shape1' }),
      example({ name: 'fixture', fixtureFingerprint: 'fixture1' }),
      example({ name: 'plain' })
    ]);

    expect(result.map((item) => item.name)).toEqual(['table', 'literal', 'fixture']);
  });

  it('returns an empty array when no examples are coverage-relevant', () => {
    expect(coverageRelevantExamples([example()])).toEqual([]);
  });
});
