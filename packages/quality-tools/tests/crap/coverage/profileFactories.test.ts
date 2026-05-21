import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  extensionCoverageProfile,
  qualityToolsCoverageProfile,
  workspacePackageCoverageProfile
} from '../../../src/crap/coverage/factories';

function writePackageJson(repoRoot: string, packageName: string, contents: Record<string, unknown>): void {
  const packageRoot = join(repoRoot, 'packages', packageName);
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(join(packageRoot, 'package.json'), JSON.stringify(contents));
}

describe('coverageProfileFactories', () => {
  it('builds the extension workspace profile', () => {
    expect(extensionCoverageProfile('/repo')).toEqual({
      args: ['--filter', 'extension', 'exec', 'vitest', 'run', '--config', 'vitest.config.ts', '--coverage'],
      command: 'pnpm',
      coveragePath: '/repo/coverage/coverage-final.json',
      cwd: '/repo',
      env: {
        QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify([
          'packages/extension/tests/**/*.test.ts',
          'packages/extension/tests/**/*.test.tsx'
        ]),
        QUALITY_TOOLS_VITEST_SCOPE: 'workspace'
      }
    });
  });

  it('builds the quality-tools package profile', () => {
    expect(qualityToolsCoverageProfile('/repo')).toEqual({
      args: ['--filter', 'quality-tools', 'exec', 'vitest', 'run', '--config', 'vitest.config.ts', '--coverage'],
      command: 'pnpm',
      coveragePath: '/repo/coverage/quality-tools/coverage-final.json',
      cwd: '/repo',
      env: {
        QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify([
          'packages/quality-tools/tests/**/*.test.ts',
          'packages/quality-tools/tests/**/*.test.tsx'
        ]),
        QUALITY_TOOLS_VITEST_SCOPE: 'workspace'
      }
    });
  });

  it('builds a workspace-scoped package profile through the extension Vitest harness', () => {
    expect(workspacePackageCoverageProfile('/repo', 'plugin-godot')).toEqual({
      args: ['--filter', 'plugin-godot', 'exec', 'vitest', 'run', '--config', 'vitest.config.ts', '--coverage'],
      command: 'pnpm',
      coveragePath: '/repo/coverage/plugin-godot/coverage-final.json',
      cwd: '/repo',
      env: {
        QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify([
          'packages/plugin-godot/tests/**/*.test.ts',
          'packages/plugin-godot/tests/**/*.test.tsx'
        ]),
        QUALITY_TOOLS_VITEST_SCOPE: 'workspace'
      }
    });
  });

  it('uses the package.json name when a workspace package declares one', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-crap-profile-'));
    writePackageJson(repoRoot, 'alpha', { name: '@poleski/alpha' });
    writePackageJson(repoRoot, 'plugin-godot', { name: '@poleski/plugin-godot' });

    expect(workspacePackageCoverageProfile(repoRoot, 'plugin-godot').args).toEqual([
      '--filter',
      '@poleski/plugin-godot',
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.config.ts',
      '--coverage'
    ]);
  });

  it('falls back to the workspace directory name when package.json has no name', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-crap-profile-'));
    writePackageJson(repoRoot, 'plugin-godot', {});

    expect(workspacePackageCoverageProfile(repoRoot, 'plugin-godot').args[1]).toBe('plugin-godot');
  });
});
