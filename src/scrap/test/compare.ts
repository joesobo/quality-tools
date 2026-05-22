import { type ScrapFileMetric } from '../model';
import { baselineMetricsByPath, readBaselineMetrics } from './discovery/files';
import { comparisonForMetric } from './metric';

export function applyBaselineComparison(
  metrics: ScrapFileMetric[],
  baselinePath: string
): ScrapFileMetric[] {
  const previousByPath = baselineMetricsByPath(readBaselineMetrics(baselinePath));

  return metrics.map((metric) => ({
    ...metric,
    comparison: comparisonForMetric(metric, previousByPath.get(metric.filePath))
  }));
}
