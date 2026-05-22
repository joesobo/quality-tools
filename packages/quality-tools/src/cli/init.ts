import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = 'quality.config.json';

const DEFAULT_CONFIG = {
  reportsDir: 'reports/quality-tools',
  defaults: {
    mutation: {
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts']
    },
    crap: {
      coverage: {
        command: 'pnpm',
        args: [
          'exec',
          'vitest',
          'run',
          '--coverage',
          '--coverage.reportsDirectory',
          '{repoRoot}/{reportsDir}/crap/{reportKey}'
        ],
        coveragePath: '{repoRoot}/{reportsDir}/crap/{reportKey}/coverage-final.json'
      },
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts']
    },
    scrap: {
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', '__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
      exclude: []
    },
    boundaries: {
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', '**/*.test.ts', '**/*.test.tsx']
    },
    organize: {
      lowInfoNames: {
        banned: ['utils', 'helpers', 'misc', 'common', 'shared', '_shared', 'lib', 'index'],
        discouraged: ['types', 'constants', 'config', 'base', 'core']
      }
    }
  },
  packages: {}
};

export function runInitCli(_args: string[] = [], cwd = process.cwd()): void {
  const configPath = join(cwd, CONFIG_FILE);

  if (existsSync(configPath)) {
    console.log(`${CONFIG_FILE} already exists`);
    return;
  }

  writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  console.log(`Created ${CONFIG_FILE}`);
}
