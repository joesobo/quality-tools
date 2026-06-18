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

  it('runs parser, DRY checker, and entrypoint generator as pipeline commands', async () => {
    const repoRoot = createAcceptanceRepo();

    await runAcceptanceCli(
      [
        'parse',
        'tests/acceptance/specs/graph-view.md',
        'build/acceptance/ir/graph-view.json'
      ],
      { cwd: repoRoot }
    );
    await runAcceptanceCli(
      [
        'dry-check',
        'build/acceptance/ir/graph-view.json',
        'build/acceptance/dry/graph-view.json'
      ],
      { cwd: repoRoot }
    );
    await runAcceptanceCli(
      [
        'generate',
        'build/acceptance/ir/graph-view.json',
        'tests/playwright/generated/graph-view.spec.ts',
        '--steps',
        'tests/acceptance/steps.ts'
      ],
      { cwd: repoRoot }
    );

    const ir = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'build/acceptance/ir/graph-view.json'), 'utf8')
    ) as unknown;
    const dry = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'build/acceptance/dry/graph-view.json'), 'utf8')
    ) as {
      summary: { findings: number; repeated_scenario_shapes: number };
      repeated_scenario_shapes: unknown[];
    };
    const generated = fs.readFileSync(
      path.join(repoRoot, 'tests/playwright/generated/graph-view.spec.ts'),
      'utf8'
    );
    const runtime = fs.readFileSync(
      path.join(repoRoot, 'tests/playwright/generated/runtime.ts'),
      'utf8'
    );

    expect(ir).toMatchObject({
      schema_version: 1,
      source_path: 'tests/acceptance/specs/graph-view.md',
      feature: {
        name: 'Graph View'
      }
    });
    expect(dry.summary.findings).toBeGreaterThan(0);
    expect(dry.summary.repeated_scenario_shapes).toBeGreaterThan(0);
    expect(generated).toContain("import { acceptanceSteps, createAcceptanceContext } from '../../acceptance/steps';");
    expect(generated).toContain("loadAcceptanceIr(path.join(__dirname, '..', '..', '..', 'build', 'acceptance', 'ir', 'graph-view.json'))");
    expect(generated).not.toContain("await test.step('Given");
    expect(runtime).toContain('export function runAcceptanceFeature(');
  });

  it('compiles matching specs by looping the pipeline over a glob', async () => {
    const repoRoot = createAcceptanceRepo();
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
        'tests/acceptance/specs/**/*.md',
        'tests/playwright/generated',
        '--steps',
        'tests/acceptance/steps.ts',
        '--ir',
        'build/acceptance/ir',
        '--dry',
        'build/acceptance/dry'
      ],
      { cwd: repoRoot }
    );

    expect(fs.existsSync(path.join(
      repoRoot,
      'tests/playwright/generated/tests-acceptance-specs-graph-view-md.spec.ts'
    ))).toBe(true);
    expect(fs.existsSync(path.join(
      repoRoot,
      'tests/playwright/generated/tests-acceptance-specs-settings-panel-md.spec.ts'
    ))).toBe(true);
    expect(fs.existsSync(path.join(
      repoRoot,
      'build/acceptance/ir/tests-acceptance-specs-graph-view-md.json'
    ))).toBe(true);
    expect(fs.existsSync(path.join(
      repoRoot,
      'build/acceptance/dry/tests-acceptance-specs-graph-view-md.json'
    ))).toBe(true);
  });
});

function createAcceptanceRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-tools-acceptance-'));
  tempRoots.push(repoRoot);
  fs.mkdirSync(path.join(repoRoot, 'tests/acceptance/specs'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'tests/acceptance/specs/graph-view.md'),
    `# Feature: Graph View

## Scenario: File node type works

Given I open the examples/example-typescript workspace
When I open the graph view
And I show no edge types
When I show only the File node type
Then I can see there are 18 nodes and 0 connections

## Scenario: Folder node type works

Given I open the examples/example-typescript workspace
When I open the graph view
And I show no edge types
When I show only the Folder node type
Then I can see there are 21 nodes and 0 connections
`
  );

  return repoRoot;
}
