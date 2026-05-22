import type { ScrapExampleMetric } from '../../../../src/scrap/model';

export function example(overrides: Partial<ScrapExampleMetric> = {}): ScrapExampleMetric {
  return {
    assertionCount: 1,
    blockPath: ['suite'],
    branchCount: 0,
    describeDepth: 1,
    duplicateSetupGroupSize: 1,
    helperCallCount: 0,
    helperHiddenLineCount: 0,
    fixtureFingerprint: undefined,
    literalShapeFingerprint: undefined,
    lineCount: 1,
    mockCount: 0,
    name: 'example',
    score: 1,
    setupFingerprint: undefined,
    setupLineCount: 0,
    startLine: 1,
    endLine: 1,
    tableDriven: false,
    ...overrides
  };
}

export function repeatedSetup(
  setupFingerprint: string,
  duplicateSetupGroupSize: number
): ScrapExampleMetric {
  return example({
    duplicateSetupGroupSize,
    setupFingerprint,
    setupLineCount: 2
  });
}

export function setupCluster(
  setupFingerprint: string,
  size: number
): ScrapExampleMetric[] {
  return Array.from({ length: size }, () => repeatedSetup(setupFingerprint, size));
}
