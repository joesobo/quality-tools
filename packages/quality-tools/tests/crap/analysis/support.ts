import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import type { IstanbulFileCoverage } from '../../../src/crap/coverage/read';

const defaultQualityConfig = {
  defaults: {
    crap: {
      exclude: ['**/e2e/**', '**/tests/**', '**/*.test.ts', '**/*.test.tsx']
    }
  }
};

function writeQualityConfig(repoRoot: string, config = defaultQualityConfig): void {
  writeFileSync(join(repoRoot, 'quality.config.json'), JSON.stringify(config));
}

export function writeFixture(
  relativePath: string,
  source: string,
  config = defaultQualityConfig
): { filePath: string; repoRoot: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-crap-'));
  writeQualityConfig(repoRoot, config);
  const filePath = join(repoRoot, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
  return { filePath, repoRoot };
}

export function writeSourceFixture(): { filePath: string; repoRoot: string } {
  return writeFixture(
    'packages/example/src/sample.ts',
    [
      'export function choose(value: number): number {',
      '  if (value > 0) {',
      '    return value;',
      '  }',
      '  return 0;',
      '}'
    ].join('\n')
  );
}

export function createCoverage(filePath: string): Record<string, IstanbulFileCoverage> {
  return {
    [filePath]: {
      path: filePath,
      s: {
        '0': 1,
        '1': 0
      },
      statementMap: {
        '0': {
          start: { column: 2, line: 2 },
          end: { column: 17, line: 2 }
        },
        '1': {
          start: { column: 2, line: 5 },
          end: { column: 11, line: 5 }
        }
      }
    }
  };
}
