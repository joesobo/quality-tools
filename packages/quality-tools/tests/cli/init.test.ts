import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInitCli } from '../../src/cli/init';

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'quality-tools-init-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(cwd, { force: true, recursive: true });
});

describe('runInitCli', () => {
  it('creates a starter quality config in the target project', () => {
    runInitCli([], cwd);

    const config = JSON.parse(readFileSync(join(cwd, 'quality.config.json'), 'utf-8')) as {
      reportsDir?: string;
      defaults?: {
        crap?: { coverage?: { coveragePath?: string } };
        mutation?: { include?: string[] };
        organize?: { lowInfoNames?: { banned?: string[] } };
      };
      packages?: Record<string, unknown>;
    };

    expect(config.reportsDir).toBe('reports/quality-tools');
    expect(config.defaults?.crap?.coverage?.coveragePath).toBe('coverage/coverage-final.json');
    expect(config.defaults?.mutation?.include).toEqual(['src/**/*.ts', 'src/**/*.tsx']);
    expect(config.defaults?.organize?.lowInfoNames?.banned).toContain('utils');
    expect(config.packages).toEqual({});
    expect(console.log).toHaveBeenCalledWith('Created quality.config.json');
  });

  it('does not overwrite an existing quality config', () => {
    const configPath = join(cwd, 'quality.config.json');
    writeFileSync(configPath, '{"custom":true}\n');

    runInitCli([], cwd);

    expect(readFileSync(configPath, 'utf-8')).toBe('{"custom":true}\n');
    expect(console.log).toHaveBeenCalledWith('quality.config.json already exists');
  });
});
