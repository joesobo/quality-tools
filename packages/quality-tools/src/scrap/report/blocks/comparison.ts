import { type ScrapFileMetric } from '../../model';

export function comparisonLines(metric: ScrapFileMetric): string[] {
  if (!metric.comparison) {
    return [];
  }

  return [
    `  compare: ${metric.comparison.verdict} avgΔ=${metric.comparison.averageScoreDelta} maxΔ=${metric.comparison.maxScoreDelta} extractΔ=${metric.comparison.extractionPressureDelta} matrixΔ=${metric.comparison.coverageMatrixDelta} dupΔ=${metric.comparison.harmfulDuplicationDelta} helperΔ=${metric.comparison.helperHiddenDelta}`
  ];
}
