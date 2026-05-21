import { coverageRelevantExamples, strongestSetupCluster } from '../../example/clusters';
import { type ScrapExampleMetric, type ScrapRecommendation } from '../../model';
import { summarizeBlockPaths, summarizeHelperGroups } from '../../report/blocks/recommendationText';

interface DuplicationRecommendationCounts {
  coverageMatrixCandidateCount: number;
  recommendedExtractionCount: number;
  tableDriveCandidateCount: number;
  zeroAssertionCount: number;
}

function strengthenAssertionsRecommendation(zeroAssertionCount: number): ScrapRecommendation[] {
  if (zeroAssertionCount === 0) {
    return [];
  }

  return [{
    confidence: 'HIGH',
    kind: 'STRENGTHEN_ASSERTIONS',
    message: `${zeroAssertionCount} example(s) have no assertions and should be tightened before structural cleanup.`
  }];
}

function tableDriveRecommendation(
  examples: ScrapExampleMetric[],
  tableDriveCandidateCount: number
): ScrapRecommendation[] {
  if (tableDriveCandidateCount === 0) {
    return [];
  }

  return [{
    confidence: 'HIGH',
    kind: 'TABLE_DRIVE',
    message: `${tableDriveCandidateCount} example(s) look like a coverage matrix that should be table-driven.${summarizeBlockPaths(coverageRelevantExamples(examples))}`
  }];
}

function extractSetupRecommendation(examples: ScrapExampleMetric[], repeatedSetupCount: number): ScrapRecommendation[] {
  if (repeatedSetupCount === 0) {
    return [];
  }

  const strongestCluster = strongestSetupCluster(examples);

  return [{
    confidence: 'MEDIUM',
    kind: 'EXTRACT_SETUP',
    message: `${repeatedSetupCount} repeated setup cluster(s) look worth extracting into shared helpers or fixtures.${summarizeBlockPaths(strongestCluster)}${summarizeHelperGroups(strongestCluster)}`
  }];
}

export function duplicationRecommendations(
  examples: ScrapExampleMetric[],
  counts: DuplicationRecommendationCounts
): ScrapRecommendation[] {
  return [
    ...strengthenAssertionsRecommendation(counts.zeroAssertionCount),
    ...tableDriveRecommendation(examples, counts.tableDriveCandidateCount),
    ...extractSetupRecommendation(examples, counts.recommendedExtractionCount)
  ];
}
