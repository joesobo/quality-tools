import { describe, expect, it } from 'vitest';
import { generatePlaywrightAcceptanceSpec } from '../../../src/acceptance/playwright/generator';
import type { AcceptanceDocument } from '../../../src/acceptance/model';

describe('playwright acceptance generator', () => {
  it('generates a Playwright spec that runs each parsed step through host bindings', () => {
    const documents: AcceptanceDocument[] = [
      {
        sourcePath: 'tests/acceptance/specs/graph-view.md',
        feature: {
          name: 'Graph View',
          line: 1
        },
        scenarios: [
          {
            name: 'Indexing shows graph progress',
            line: 3,
            steps: [
              {
                keyword: 'Given',
                text: 'I open the example workspace',
                line: 5
              },
              {
                keyword: 'Then',
                text: 'I see file nodes',
                line: 6
              }
            ]
          }
        ]
      }
    ];

    const source = generatePlaywrightAcceptanceSpec(documents, {
      stepsImportPath: '../../acceptance/steps'
    });

    expect(source).toContain("import { test } from '@playwright/test';");
    expect(source).toContain('/* eslint-disable no-empty-pattern */');
    expect(source).toContain("import { acceptanceSteps, createAcceptanceContext } from '../../acceptance/steps';");
    expect(source).toContain("test.describe('Graph View', () => {");
    expect(source).toContain("test('Indexing shows graph progress', async ({}, testInfo) => {");
    expect(source).toContain('} finally {');
    expect(source).toContain('await context.cleanup?.();');
    expect(source).toContain("await test.step('Given I open the example workspace'");
    expect(source).toContain("await runAcceptanceStep(context, 'I open the example workspace'");
    expect(source).toContain("tests/acceptance/specs/graph-view.md:5");
  });
});
