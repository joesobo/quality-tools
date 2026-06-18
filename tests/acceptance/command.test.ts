import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runAcceptanceCli } from '../../src/acceptance/command';

const tempRoots: string[] = [];

describe('acceptance command', () => {
  afterEach(() => {
    tempRoots.splice(0).forEach((tempRoot) => {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    });
  });

  it('compiles markdown specs into a Playwright spec', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-tools-acceptance-'));
    tempRoots.push(repoRoot);
    fs.mkdirSync(path.join(repoRoot, 'tests/acceptance/specs'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'tests/acceptance/specs/graph-view.md'),
      `# Feature: Graph View

## Scenario: Opening the graph

Given I open the example workspace
Then I see file nodes
`
    );

    await runAcceptanceCli(
      [
        'compile',
        '--spec',
        'tests/acceptance/specs/**/*.md',
        '--steps',
        'tests/acceptance/steps.ts',
        '--out',
        'tests/playwright/generated/acceptance.spec.ts'
      ],
      {
        cwd: repoRoot
      }
    );

    const generated = fs.readFileSync(
      path.join(repoRoot, 'tests/playwright/generated/acceptance.spec.ts'),
      'utf8'
    );

    expect(generated).toContain("import { acceptanceSteps, createAcceptanceContext } from '../../acceptance/steps';");
    expect(generated).toContain("test.describe('Graph View', () => {");
    expect(generated).toContain("test('Opening the graph', async ({}, testInfo) => {");
  });

  it('writes split Playwright entrypoints with JSON IR and advisory DRY reports', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-tools-acceptance-'));
    tempRoots.push(repoRoot);
    fs.mkdirSync(path.join(repoRoot, 'tests/acceptance/specs'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'tests/acceptance/specs/graph-view.md'),
      `# Feature: Graph View

## Scenario: Opening the graph

Given I open the <workspace> workspace
Then I see file nodes
Then I see file nodes
`
    );
    fs.writeFileSync(
      path.join(repoRoot, 'tests/acceptance/specs/settings-panel.md'),
      `# Feature: Settings Panel

## Scenario: Opening settings

Given I open the example workspace
Then I see settings
`
    );

    await runAcceptanceCli(
      [
        'compile',
        '--spec',
        'tests/acceptance/specs/**/*.md',
        '--steps',
        'tests/acceptance/steps.ts',
        '--out-dir',
        'tests/playwright/generated',
        '--ir-dir',
        'build/acceptance/ir',
        '--dry-report-dir',
        'build/acceptance/dry'
      ],
      {
        cwd: repoRoot
      }
    );

    const graphSpec = fs.readFileSync(
      path.join(repoRoot, 'tests/playwright/generated/tests-acceptance-specs-graph-view-md.spec.ts'),
      'utf8'
    );
    const settingsSpec = fs.readFileSync(
      path.join(repoRoot, 'tests/playwright/generated/tests-acceptance-specs-settings-panel-md.spec.ts'),
      'utf8'
    );
    const graphIr = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'build/acceptance/ir/tests-acceptance-specs-graph-view-md.json'), 'utf8')
    ) as unknown;
    const graphDry = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'build/acceptance/dry/tests-acceptance-specs-graph-view-md.json'), 'utf8')
    ) as {
      summary: { findings: number };
      findings: Array<{ kind: string }>;
    };

    expect(graphSpec).toContain("test.describe('Graph View', () => {");
    expect(graphSpec).toContain("import { acceptanceSteps, createAcceptanceContext } from '../../acceptance/steps';");
    expect(settingsSpec).toContain("test.describe('Settings Panel', () => {");
    expect(graphIr).toMatchObject({
      schema_version: 1,
      source_path: 'tests/acceptance/specs/graph-view.md',
      feature: {
        name: 'Graph View'
      }
    });
    expect(graphDry.summary.findings).toBeGreaterThan(0);
    expect(graphDry.findings).toContainEqual(expect.objectContaining({ kind: 'duplicate-in-scenario' }));
  });
});
