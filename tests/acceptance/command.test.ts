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
    expect(generated).toContain("test('Opening the graph', async ({ page }, testInfo) => {");
  });
});
