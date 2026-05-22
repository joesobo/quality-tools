export function remediationMode(
  exampleCount: number,
  averageScore: number,
  hotExampleCount: number,
  maxScore: number
): 'LOCAL' | 'SPLIT' | 'STABLE' {
  if (
    hotExampleCount >= 10 ||
    (exampleCount >= 30 && averageScore >= 5) ||
    (exampleCount >= 50 && averageScore >= 4.25)
  ) {
    return 'SPLIT';
  }

  if (maxScore >= 6 || averageScore >= 4) {
    return 'LOCAL';
  }

  return 'STABLE';
}
