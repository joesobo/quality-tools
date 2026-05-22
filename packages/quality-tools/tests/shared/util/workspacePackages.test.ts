import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { listWorkspacePackages } from '../../../src/shared/util/workspacePackages';

function createWorkspaceRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-workspaces-'));
  writeFileSync(join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  mkdirSync(join(repoRoot, 'packages/alpha'), { recursive: true });
  mkdirSync(join(repoRoot, 'packages/zeta'), { recursive: true });
  mkdirSync(join(repoRoot, 'packages/no-package'), { recursive: true });
  writeFileSync(join(repoRoot, 'packages/README.md'), 'not a package');
  writeFileSync(join(repoRoot, 'packages/alpha/package.json'), '{}');
  writeFileSync(join(repoRoot, 'packages/zeta/package.json'), '{}');
  return repoRoot;
}

describe('listWorkspacePackages', () => {
  it('returns sorted packages with package.json files', () => {
    const repoRoot = createWorkspaceRepo();
    expect(listWorkspacePackages(repoRoot)).toEqual([
      { name: 'alpha', relativeRoot: 'packages/alpha', root: join(repoRoot, 'packages/alpha') },
      { name: 'zeta', relativeRoot: 'packages/zeta', root: join(repoRoot, 'packages/zeta') }
    ]);
  });

  it('uses workspace globs instead of assuming packages/*', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-workspaces-'));
    writeFileSync(join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'tools/*'\n");
    mkdirSync(join(repoRoot, 'apps/web'), { recursive: true });
    mkdirSync(join(repoRoot, 'tools/cli'), { recursive: true });
    writeFileSync(join(repoRoot, 'apps/web/package.json'), '{"name":"@scope/web"}');
    writeFileSync(join(repoRoot, 'tools/cli/package.json'), '{"name":"tool-cli"}');

    expect(listWorkspacePackages(repoRoot)).toEqual([
      {
        manifestName: 'tool-cli',
        name: 'tool-cli',
        relativeRoot: 'tools/cli',
        root: join(repoRoot, 'tools/cli')
      },
      {
        manifestName: '@scope/web',
        name: 'web',
        relativeRoot: 'apps/web',
        root: join(repoRoot, 'apps/web')
      }
    ]);
  });

  it('uses package.json workspaces when pnpm-workspace.yaml is absent', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-workspaces-'));
    writeFileSync(join(repoRoot, 'package.json'), '{"workspaces":["modules/*"]}');
    mkdirSync(join(repoRoot, 'modules/parser'), { recursive: true });
    writeFileSync(join(repoRoot, 'modules/parser/package.json'), '{"name":"parser"}');

    expect(listWorkspacePackages(repoRoot)).toEqual([
      {
        manifestName: 'parser',
        name: 'parser',
        relativeRoot: 'modules/parser',
        root: join(repoRoot, 'modules/parser')
      }
    ]);
  });
});
