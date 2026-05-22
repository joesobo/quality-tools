import { isAbsolute, join, relative, resolve } from 'path';
import {
  type CrapCoverageConfig,
  relativeReportsDir,
  resolvePackageCrapCoverage,
  resolveReportPath
} from '../../config/quality';
import { type QualityTarget } from '../../shared/resolve/target';
import { relativeTo, toPosix } from '../../shared/util/pathUtils';
import { sanitizeReportKey } from '../../shared/util/reportKey';
import { listWorkspacePackages } from '../../shared/util/workspacePackages';
import { type CoverageProfile } from './profiles';

interface CoverageTemplateValues {
  packageJsonName: string;
  packageName: string;
  packageRoot: string;
  reportKey: string;
  reportsDir: string;
  repoRoot: string;
  target: string;
  targetPath: string;
}

function workspacePackageName(repoRoot: string, packageName: string | undefined): string | undefined {
  if (!packageName) {
    return undefined;
  }

  const workspacePackage = listWorkspacePackages(repoRoot).find((entry) => entry.name === packageName);
  return workspacePackage?.manifestName ?? packageName;
}

function targetPackageRoot(repoRoot: string, target: QualityTarget): string {
  return target.packageRoot ?? repoRoot;
}

function reportKeyForTarget(target: QualityTarget): string {
  if (target.kind === 'repo') {
    return 'repo';
  }

  return target.packageName ?? sanitizeReportKey(target.relativePath);
}

function templateValues(repoRoot: string, target: QualityTarget): CoverageTemplateValues {
  const packageName = target.packageName ?? '';
  const packageRoot = targetPackageRoot(repoRoot, target);

  return {
    packageJsonName: workspacePackageName(repoRoot, target.packageName) ?? packageName,
    packageName,
    packageRoot,
    reportKey: reportKeyForTarget(target),
    reportsDir: relativeReportsDir(repoRoot),
    repoRoot,
    target: target.relativePath,
    targetPath: target.relativePath
  };
}

function applyTemplate(value: string, values: CoverageTemplateValues): string {
  return value.replace(/\{([a-zA-Z]+)\}/g, (match, rawKey: string) => {
    const key = rawKey as keyof CoverageTemplateValues;
    return values[key] ?? match;
  });
}

function resolvePathFromRepo(repoRoot: string, value: string): string {
  return isAbsolute(value) ? value : resolve(repoRoot, value);
}

function configuredCoverageProfile(
  repoRoot: string,
  target: QualityTarget,
  config: CrapCoverageConfig
): CoverageProfile {
  const values = templateValues(repoRoot, target);
  const cwd = config.cwd ? resolvePathFromRepo(repoRoot, applyTemplate(config.cwd, values)) : repoRoot;
  const defaultProfile = defaultCoverageProfile(repoRoot, target);
  const coveragePath = config.coveragePath
    ? resolvePathFromRepo(repoRoot, applyTemplate(config.coveragePath, values))
    : defaultProfile.coveragePath;

  return {
    args: (config.args ?? defaultProfile.args).map((arg) => applyTemplate(arg, values)),
    command: config.command ? applyTemplate(config.command, values) : defaultProfile.command,
    coveragePath,
    cwd,
    ...(config.env
      ? {
          env: Object.fromEntries(
            Object.entries(config.env).map(([key, value]) => [key, applyTemplate(value, values)])
          )
        }
      : {})
  };
}

export function defaultCoverageProfile(repoRoot: string, target: QualityTarget): CoverageProfile {
  const packageJsonName = workspacePackageName(repoRoot, target.packageName);
  const reportDirectory = resolveReportPath(repoRoot, 'crap', reportKeyForTarget(target));

  if (target.packageName && packageJsonName) {
    return {
      args: [
        '--filter',
        packageJsonName,
        'exec',
        'vitest',
        'run',
        '--coverage',
        '--coverage.reportsDirectory',
        reportDirectory
      ],
      command: 'pnpm',
      coveragePath: join(reportDirectory, 'coverage-final.json'),
      cwd: repoRoot
    };
  }

  return {
    args: ['exec', 'vitest', 'run', '--coverage', '--coverage.reportsDirectory', reportDirectory],
    command: 'pnpm',
    coveragePath: join(reportDirectory, 'coverage-final.json'),
    cwd: repoRoot
  };
}

export function coverageProfilesForTarget(repoRoot: string, target: QualityTarget): CoverageProfile[] {
  const configuredProfiles = resolvePackageCrapCoverage(repoRoot, target.packageName);
  if (configuredProfiles.length > 0) {
    return configuredProfiles.map((config) => configuredCoverageProfile(repoRoot, target, config));
  }

  return [defaultCoverageProfile(repoRoot, target)];
}

export function coveragePathForReport(repoRoot: string, coveragePath: string): string {
  return toPosix(relative(repoRoot, coveragePath)).startsWith('..')
    ? coveragePath
    : relativeTo(repoRoot, coveragePath);
}
