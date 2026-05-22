import { describe, expect, it } from 'vitest';
import { analyzeCrap } from '../../../../src/crap/analysis/run';
import { createCoverage, writeSourceFixture } from '../support';

describe('analyzeCrap source scope', () => {
  it('reports functions above the threshold for the requested source scope', () => {
    const { filePath, repoRoot } = writeSourceFixture();
    const results = analyzeCrap(
      [createCoverage(filePath)],
      repoRoot,
      'packages/example/src',
      2
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      complexity: 2,
      file: 'packages/example/src/sample.ts',
      name: 'choose'
    });
  });
});
