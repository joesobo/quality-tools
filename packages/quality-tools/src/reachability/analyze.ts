import { analyzeBoundaries } from '../boundaries/analyze';
import type { QualityTarget } from '../shared/resolve/target';
import type { ReachabilityReport } from './model';

export function analyzeReachability(repoRoot: string, target: QualityTarget): ReachabilityReport {
  const report = analyzeBoundaries(repoRoot, target);
  return {
    deadEnds: report.deadEnds,
    deadSurfaces: report.deadSurfaces,
    files: report.files,
    target: report.target
  };
}
