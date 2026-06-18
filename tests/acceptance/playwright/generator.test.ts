import { describe, expect, it } from 'vitest';
import {
  generatePlaywrightAcceptanceRuntime,
  generatePlaywrightAcceptanceSpec
} from '../../../src/acceptance/playwright/generator';

describe('playwright acceptance generator', () => {
  it('generates a thin Playwright spec that delegates to JSON IR and runtime', () => {
    const source = generatePlaywrightAcceptanceSpec({
      irImportPath: '../generated-ir/graph-view.json',
      runtimeImportPath: './runtime',
      stepsImportPath: '../../acceptance/steps'
    });

    expect(source).toContain("import { test } from '@playwright/test';");
    expect(source).toContain("import { acceptanceSteps, createAcceptanceContext } from '../../acceptance/steps';");
    expect(source).toContain("import { loadAcceptanceIr, runAcceptanceFeature } from './runtime';");
    expect(source).toContain("const feature = loadAcceptanceIr('../generated-ir/graph-view.json');");
    expect(source).toContain('runAcceptanceFeature(test, feature, {');
    expect(source).not.toContain('/* eslint-disable playwright/expect-expect */');
    expect(source).not.toContain("test.describe('Graph View'");
    expect(source).not.toContain("await test.step('Given");
  });

  it('generates a shared runtime that expands background, examples, and host step handlers', () => {
    const source = generatePlaywrightAcceptanceRuntime();

    expect(source).toContain('/* eslint-disable playwright/expect-expect */');
    expect(source).toContain('export function loadAcceptanceIr(filePath: string): AcceptanceIrDocument');
    expect(source).toContain('export function runAcceptanceFeature(');
    expect(source).toContain('test(execution.name, async ({}, testInfo) => {');
    expect(source).not.toContain('async (_fixtures, testInfo)');
    expect(source).toContain('steps: [...(feature.background?.steps ?? []), ...scenario.steps].map');
    expect(source).toContain('text: renderStepText(step.text, example.values)');
    expect(source).toContain('?? registry[step.sourceText]');
  });
});
