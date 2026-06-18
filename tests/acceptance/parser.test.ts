import { describe, expect, it } from 'vitest';
import { parseAcceptanceMarkdown } from '../../src/acceptance/parser';

describe('acceptance markdown parser', () => {
  it('parses a feature with one scenario and ordered steps', () => {
    const document = parseAcceptanceMarkdown(
      `# Feature: Graph View

## Scenario: Indexing shows graph progress

Given I open the example workspace
When I open the graph view
Then I see file nodes
And I see edges
`,
      'tests/acceptance/specs/graph-view.md'
    );

    expect(document).toEqual({
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
              line: 5,
              parameters: []
            },
            {
              keyword: 'When',
              text: 'I open the graph view',
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
              keyword: 'And',
              text: 'I see edges',
              line: 8,
              parameters: []
            }
          ]
        }
      ]
    });
  });

  it('records placeholder parameters from step text', () => {
    const document = parseAcceptanceMarkdown(
      `# Feature: Graph View

## Scenario: Open a workspace

Given I open the <workspace> workspace
Then <node_name> is visible in <workspace>
`,
      'tests/acceptance/specs/graph-view.md'
    );

    expect(document.scenarios[0]?.steps).toEqual([
      expect.objectContaining({
        text: 'I open the <workspace> workspace',
        parameters: ['workspace']
      }),
      expect.objectContaining({
        text: '<node_name> is visible in <workspace>',
        parameters: ['node_name', 'workspace']
      })
    ]);
  });

  it('rejects a feature without scenarios', () => {
    expect(() => parseAcceptanceMarkdown(
      '# Feature: Graph View\n',
      'tests/acceptance/specs/graph-view.md'
    )).toThrow('tests/acceptance/specs/graph-view.md: Expected at least one Scenario');
  });

  it('rejects a scenario without steps', () => {
    expect(() => parseAcceptanceMarkdown(
      `# Feature: Graph View

## Scenario: Empty scenario
`,
      'tests/acceptance/specs/graph-view.md'
    )).toThrow('tests/acceptance/specs/graph-view.md:3 Scenario "Empty scenario" must contain at least one step');
  });
});
