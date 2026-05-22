import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeBoundaries } from '../../src/boundaries/analyze';

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((tempDir) => rmSync(tempDir, { force: true, recursive: true }));
});

function writeWorkspace(files: Record<string, string>): { packageRoot: string; repoRoot: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-boundaries-scope-'));
  tempDirs.push(repoRoot);
  const packageRoot = join(repoRoot, 'packages', 'extension');

  writeFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  writeFileSync(
    join(repoRoot, 'quality.config.json'),
    JSON.stringify({
      defaults: {
        boundaries: {
          include: ['src/**/*.ts']
        }
      }
    })
  );
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: 'extension' }));

  for (const [relativePath, source] of Object.entries(files)) {
    const absolutePath = join(packageRoot, relativePath);
    mkdirSync(join(absolutePath, '..'), { recursive: true });
    writeFileSync(absolutePath, source);
  }

  return { packageRoot, repoRoot };
}

describe('analyzeBoundaries target scope', () => {
  it('reports only selected directory files while preserving package graph edges', () => {
    const { packageRoot, repoRoot } = writeWorkspace({
      'src/core/a.ts': "import { shared } from '../shared/shared';\nexport const a = shared;\n",
      'src/core/local.ts': 'export const local = 1;\n',
      'src/shared/shared.ts': 'export const shared = 1;\n',
      'src/webview/view.ts': "import { a } from '../core/a';\nexport const view = a;\n"
    });

    const report = analyzeBoundaries(repoRoot, {
      absolutePath: join(packageRoot, 'src', 'core'),
      kind: 'directory',
      packageName: 'extension',
      packageRelativePath: 'src/core',
      packageRoot,
      relativePath: 'packages/extension/src/core'
    });

    expect(report.target).toBe('packages/extension/src/core');
    expect(report.files.map((file) => file.relativePath)).toEqual([
      'packages/extension/src/core/a.ts',
      'packages/extension/src/core/local.ts'
    ]);
    expect(report.files.find((file) => file.relativePath === 'packages/extension/src/core/a.ts')).toMatchObject({
      incoming: 1,
      outgoing: 1
    });
    expect(report.deadSurfaces).toEqual([]);
    expect(report.deadEnds.map((file) => file.relativePath)).toEqual([
      'packages/extension/src/core/local.ts'
    ]);
  });

  it('reports only the selected file for file targets', () => {
    const { packageRoot, repoRoot } = writeWorkspace({
      'src/core/a.ts': "import { shared } from '../shared/shared';\nexport const a = shared;\n",
      'src/shared/shared.ts': 'export const shared = 1;\n',
      'src/webview/view.ts': "import { a } from '../core/a';\nexport const view = a;\n"
    });

    const report = analyzeBoundaries(repoRoot, {
      absolutePath: join(packageRoot, 'src', 'core', 'a.ts'),
      kind: 'file',
      packageName: 'extension',
      packageRelativePath: 'src/core/a.ts',
      packageRoot,
      relativePath: 'packages/extension/src/core/a.ts'
    });

    expect(report.target).toBe('packages/extension/src/core/a.ts');
    expect(report.files.map((file) => file.relativePath)).toEqual([
      'packages/extension/src/core/a.ts'
    ]);
    expect(report.files[0]).toMatchObject({
      incoming: 1,
      outgoing: 1
    });
  });
});
