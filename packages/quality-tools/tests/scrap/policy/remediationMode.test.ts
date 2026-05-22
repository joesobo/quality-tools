import { describe, expect, it } from 'vitest';
import { remediationMode } from '../../../src/scrap/policy/remediationMode';

describe('remediationMode', () => {
  it('promotes files with heavy pressure to split', () => {
    expect(remediationMode(20, 4, 10, 10)).toBe('SPLIT');
    expect(remediationMode(30, 5, 2, 4)).toBe('SPLIT');
    expect(remediationMode(50, 4.25, 1, 4)).toBe('SPLIT');
  });

  it('uses local for max score and average score pressure', () => {
    expect(remediationMode(2, 4, 1, 6)).toBe('LOCAL');
    expect(remediationMode(2, 4, 0, 2)).toBe('LOCAL');
    expect(remediationMode(2, 3, 0, 6)).toBe('LOCAL');
  });

  it('keeps low pressure files stable when split and local thresholds are not met', () => {
    expect(remediationMode(8, 4, 2, 5)).toBe('LOCAL');
    expect(remediationMode(8, 5, 2, 4)).toBe('LOCAL');
    expect(remediationMode(4, 5, 3, 10)).toBe('LOCAL');
    expect(remediationMode(20, 4.25, 2, 4)).toBe('LOCAL');
    expect(remediationMode(12, 5.5, 1, 4)).toBe('LOCAL');
    expect(remediationMode(1, 3, 0, 5)).toBe('STABLE');
    expect(remediationMode(7, 3, 2, 3)).toBe('STABLE');
  });
});
