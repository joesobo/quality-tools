import { readFileSync } from 'fs';
import { isAbsolute, join, matchesGlob, relative, resolve } from 'path';
import { mergeBoundaryPatterns, mergeToolPatterns, packageRootPattern } from './patterns';
import { toPosix } from '../shared/util/pathUtils';
import { listWorkspacePackages } from '../shared/util/workspacePackages';

export type QualityToolName = 'boundaries' | 'crap' | 'mutation' | 'scrap' | 'organize';

export interface QualityToolPatterns {
  exclude?: string[];
  include?: string[];
}

export interface BoundaryLayerRule {
  allow: string[];
  include: string[];
  name: string;
}

export interface BoundaryToolPatterns extends QualityToolPatterns {
  entrypoints?: string[];
  layers?: BoundaryLayerRule[];
}

export interface QualityCommandConfig {
  args?: string[];
  command?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface CrapCoverageConfig extends QualityCommandConfig {
  coveragePath?: string;
}

export interface CrapToolPatterns extends QualityToolPatterns {
  coverage?: CrapCoverageConfig | CrapCoverageConfig[];
}

export interface MutationToolPatterns extends QualityToolPatterns {
  strykerConfig?: string;
}

interface QualityConfigBlock {
  boundaries?: BoundaryToolPatterns;
  crap?: CrapToolPatterns;
  mutation?: MutationToolPatterns;
  scrap?: QualityToolPatterns;
  organize?: QualityToolPatterns;
}

interface QualityConfig {
  defaults?: QualityConfigBlock;
  packages?: Record<string, QualityConfigBlock>;
  reportsDir?: string;
}

export interface ResolvedToolPatterns {
  exclude: string[];
  include: string[];
}

export interface ResolvedBoundaryConfig extends ResolvedToolPatterns {
  entrypoints: string[];
  layers: BoundaryLayerRule[];
}

const CONFIG_FILE = 'quality.config.json';
const DEFAULT_REPORTS_DIR = 'reports/quality-tools';

export function loadQualityConfig(repoRoot: string): QualityConfig {
  const configPath = join(repoRoot, CONFIG_FILE);

  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as QualityConfig;
  } catch {
    return {};
  }
}

function resolveFromRepoRoot(repoRoot: string, value: string): string {
  return isAbsolute(value) ? value : resolve(repoRoot, value);
}

export function resolveReportsDir(repoRoot: string): string {
  const config = loadQualityConfig(repoRoot);
  return resolveFromRepoRoot(repoRoot, config.reportsDir ?? DEFAULT_REPORTS_DIR);
}

export function relativeReportsDir(repoRoot: string): string {
  return toPosix(relative(repoRoot, resolveReportsDir(repoRoot)));
}

export function resolveReportPath(repoRoot: string, ...segments: string[]): string {
  return join(resolveReportsDir(repoRoot), ...segments);
}

export function relativeReportPath(repoRoot: string, ...segments: string[]): string {
  return toPosix(relative(repoRoot, resolveReportPath(repoRoot, ...segments)));
}

export function resolvePackageToolPatterns(
  repoRoot: string,
  packageName: string,
  toolName: QualityToolName
): ResolvedToolPatterns {
  const config = loadQualityConfig(repoRoot);
  return mergeToolPatterns(config.defaults?.[toolName], config.packages?.[packageName]?.[toolName]);
}

export function resolveDefaultToolPatterns(
  repoRoot: string,
  toolName: QualityToolName
): ResolvedToolPatterns {
  const config = loadQualityConfig(repoRoot);
  return mergeToolPatterns(config.defaults?.[toolName], undefined);
}

export function resolvePackageToolGlobs(
  repoRoot: string,
  packageName: string,
  toolName: QualityToolName
): ResolvedToolPatterns {
  const patterns = resolvePackageToolPatterns(repoRoot, packageName, toolName);
  const workspacePackage = listWorkspacePackages(repoRoot).find((entry) => entry.name === packageName);
  const packageRelativeRoot = workspacePackage?.relativeRoot ?? packageName;

  return {
    exclude: patterns.exclude.map((pattern) => packageRootPattern(packageRelativeRoot, pattern)),
    include: patterns.include.map((pattern) => packageRootPattern(packageRelativeRoot, pattern))
  };
}

export function resolvePackageCrapCoverage(
  repoRoot: string,
  packageName: string | undefined
): CrapCoverageConfig[] {
  const config = loadQualityConfig(repoRoot);
  const coverage = packageName
    ? config.packages?.[packageName]?.crap?.coverage ?? config.defaults?.crap?.coverage
    : config.defaults?.crap?.coverage;

  if (!coverage) {
    return [];
  }

  return Array.isArray(coverage) ? coverage : [coverage];
}

export function resolveMutationStrykerConfig(
  repoRoot: string,
  packageName: string | undefined
): string | undefined {
  const config = loadQualityConfig(repoRoot);
  const configuredPath = packageName
    ? config.packages?.[packageName]?.mutation?.strykerConfig ?? config.defaults?.mutation?.strykerConfig
    : config.defaults?.mutation?.strykerConfig;

  return configuredPath ? resolveFromRepoRoot(repoRoot, configuredPath) : undefined;
}

export function resolvePackageBoundaryConfig(
  repoRoot: string,
  packageName: string
): ResolvedBoundaryConfig {
  const config = loadQualityConfig(repoRoot);
  return mergeBoundaryPatterns(config.defaults?.boundaries, config.packages?.[packageName]?.boundaries);
}

export function pathIncludedByTool(
  repoRoot: string,
  packageName: string,
  toolName: QualityToolName,
  packageRelativePath: string
): boolean {
  const patterns = resolvePackageToolPatterns(repoRoot, packageName, toolName);
  const normalizedPath = toPosix(packageRelativePath);
  const included = patterns.include.length === 0 || patterns.include.some((pattern) => (
    matchesGlob(normalizedPath, pattern)
  ));
  const excluded = patterns.exclude.some((pattern) => matchesGlob(normalizedPath, pattern));
  return included && !excluded;
}

export function pathIncludedByDefaultTool(
  repoRoot: string,
  toolName: QualityToolName,
  repoRelativePath: string
): boolean {
  const patterns = resolveDefaultToolPatterns(repoRoot, toolName);
  const normalizedPath = toPosix(repoRelativePath);
  const included = patterns.include.length === 0 || patterns.include.some((pattern) => (
    matchesGlob(normalizedPath, pattern)
  ));
  const excluded = patterns.exclude.some((pattern) => matchesGlob(normalizedPath, pattern));
  return included && !excluded;
}
