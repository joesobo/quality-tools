import type { BoundaryFileNode } from '../boundaries/model';

export interface ReachabilityReport {
  deadEnds: BoundaryFileNode[];
  deadSurfaces: BoundaryFileNode[];
  files: BoundaryFileNode[];
  target: string;
}
