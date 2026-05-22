import { describe, expect, it } from 'vitest';
import { groupSetupExamples, strongestSetupCluster } from '../../../../src/scrap/example/clusters';
import { example, repeatedSetup, setupCluster } from './support';

describe('setup clustering', () => {
  it('groups repeated setup examples by fingerprint', () => {
    const result = groupSetupExamples([
      ...setupCluster('fp1', 2),
      repeatedSetup('fp2', 2),
      example({ setupLineCount: 1 })
    ]);

    expect(result.map((cluster) => cluster.length)).toEqual([2, 1]);
  });

  it('returns the largest repeated setup cluster', () => {
    const result = strongestSetupCluster([
      ...setupCluster('fp1', 2),
      ...setupCluster('fp2', 3)
    ]);

    expect(result).toHaveLength(3);
    expect(result.every((item) => item.setupFingerprint === 'fp2')).toBe(true);
  });

  it('returns an empty array when no repeated setup exists', () => {
    expect(strongestSetupCluster([example({ setupLineCount: 1 })])).toEqual([]);
  });
});
