import { describe, expect, it } from 'vitest';
import { analyzeAcceptanceIrDryness } from '../../src/acceptance/dryChecker';
import type { AcceptanceIrDocument } from '../../src/acceptance/ir';

describe('acceptance IR DRY checker', () => {
  it('reports repeated steps and scenario shapes without rewriting the IR', () => {
    const document: AcceptanceIrDocument = {
      schema_version: 1,
      source_path: 'features/graph-view.feature',
      feature: {
        name: 'Graph View',
        line: 1
      },
      scenarios: [
        {
          name: 'File node type works',
          line: 3,
          examples: [],
          steps: [
            step('Given', 'I open the examples/example-typescript workspace', 5),
            step('When', 'I open the graph view', 6),
            step('And', 'I show no edge types', 7),
            step('When', 'I show only the File node type', 8),
            step('Then', 'I can see there are 18 nodes and 0 connections', 9),
            step('Then', 'I can see there are 18 nodes and 0 connections', 10)
          ]
        },
        {
          name: 'Folder node type works',
          line: 12,
          examples: [],
          steps: [
            step('Given', 'I open the examples/example-typescript workspace', 14),
            step('When', 'I open the graph view', 15),
            step('And', 'I show no edge types', 16),
            step('When', 'I show only the Folder node type', 17),
            step('Then', 'I can see there are 21 nodes and 0 connections', 18)
          ]
        }
      ]
    };

    const report = analyzeAcceptanceIrDryness(document);

    expect(report).toMatchObject({
      schema_version: 1,
      source_path: 'features/graph-view.feature',
      feature_name: 'Graph View',
      summary: {
        scenarios: 2,
        step_occurrences: 11,
        repeated_scenario_shapes: 1
      }
    });
    expect(report.findings).toContainEqual(expect.objectContaining({
      kind: 'duplicate-in-scenario',
      confidence: 'high',
      canonical_candidate: 'I can see there are 18 nodes and 0 connections'
    }));
    expect(report.findings).toContainEqual(expect.objectContaining({
      kind: 'repeated-step-pattern',
      confidence: 'high',
      canonical_candidate: 'I show only the <node-type> node type'
    }));
    expect(report.repeated_scenario_shapes).toContainEqual(expect.objectContaining({
      confidence: 'medium',
      scenario_count: 2,
      shared_step_count: 4
    }));
  });

  it('does not report restored-state assertions as duplicate steps', () => {
    const document: AcceptanceIrDocument = {
      schema_version: 1,
      source_path: 'features/graph-scope.feature',
      feature: {
        name: 'Graph Scope',
        line: 1
      },
      scenarios: [
        {
          name: 'Imports edge can be toggled off and restored',
          line: 3,
          examples: [],
          steps: [
            step('Given', 'I open the examples/example-typescript workspace', 5),
            step('When', 'I open the graph view', 6),
            step('And', 'I show only the Imports edge', 7),
            step('Then', 'src/index.ts points to src/user.ts', 8),
            step('When', 'I toggle the Imports edge off', 9),
            step('Then', 'I can see there are 6 nodes and 0 connections', 10),
            step('When', 'I toggle the Imports edge on', 11),
            step('Then', 'src/index.ts points to src/user.ts', 12)
          ]
        }
      ]
    };

    const report = analyzeAcceptanceIrDryness(document);

    expect(report.findings).not.toContainEqual(expect.objectContaining({
      kind: 'duplicate-in-scenario',
      canonical_candidate: 'src/index.ts points to src/user.ts'
    }));
  });

  it('reports similar steps only when requested', () => {
    const document: AcceptanceIrDocument = {
      schema_version: 1,
      source_path: 'features/graph-view.feature',
      feature: {
        name: 'Graph View',
        line: 1
      },
      scenarios: [
        {
          name: 'Similar wording',
          line: 3,
          examples: [],
          steps: [
            step('Given', 'I open the graph view', 5),
            step('When', 'I open the graph view', 6),
            step('Then', 'I open graph panel', 7),
            step('Then', 'I open the <target> view', 8),
            step('Then', 'I open the <panel> view', 9),
            step('Then', 'workspace loads unrelated fixtures', 10)
          ]
        }
      ]
    };

    const defaultReport = analyzeAcceptanceIrDryness(document);
    const similarReport = analyzeAcceptanceIrDryness(document, { includeSimilar: true });

    expect(defaultReport.findings).not.toContainEqual(expect.objectContaining({
      kind: 'possible-synonym'
    }));
    expect(similarReport.findings).toContainEqual(expect.objectContaining({
      kind: 'possible-synonym',
      confidence: 'low',
      canonical_candidate: 'I open the graph view',
      score: 0.5
    }));
  });
});

function step(keyword: 'Given' | 'When' | 'Then' | 'And' | 'But', text: string, line: number) {
  return {
    keyword,
    text,
    line,
    parameters: [...text.matchAll(/<([A-Za-z0-9_]+)>/g)].map((match) => match[1] ?? '')
  };
}
