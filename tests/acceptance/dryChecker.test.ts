import { describe, expect, it } from 'vitest';
import { analyzeAcceptanceIrDryness } from '../../src/acceptance/dryChecker';
import type { AcceptanceDocument } from '../../src/acceptance/model';

describe('acceptance IR DRY checker', () => {
  it('reports duplicate and overlapping step text without rewriting the IR', () => {
    const document: AcceptanceDocument = {
      sourcePath: 'features/graph-view.feature',
      feature: {
        name: 'Graph View',
        line: 1
      },
      scenarios: [
        {
          name: 'Open workspaces',
          line: 3,
          steps: [
            {
              keyword: 'Given',
              text: 'I open the <workspace> workspace',
              line: 5,
              parameters: ['workspace']
            },
            {
              keyword: 'Then',
              text: 'I see file nodes',
              line: 6,
              parameters: []
            },
            {
              keyword: 'Then',
              text: 'I see file nodes',
              line: 7,
              parameters: []
            },
            {
              keyword: 'Given',
              text: 'I open the <project> workspace',
              line: 8,
              parameters: ['project']
            }
          ]
        }
      ]
    };

    const report = analyzeAcceptanceIrDryness(document);

    expect(report).toMatchObject({
      schema_version: 1,
      feature_name: 'Graph View',
      summary: {
        step_occurrences: 4,
        unique_steps: 3
      }
    });
    expect(report.findings).toContainEqual(expect.objectContaining({
      kind: 'duplicate-in-scenario',
      confidence: 'high',
      canonical_candidate: 'I see file nodes'
    }));
    expect(report.findings).toContainEqual(expect.objectContaining({
      kind: 'placeholder-variant',
      confidence: 'high',
      canonical_candidate: 'I open the <_1> workspace'
    }));
  });
});
