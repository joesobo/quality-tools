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
              line: 5
            },
            {
              keyword: 'When',
              text: 'I open the graph view',
              line: 6
            },
            {
              keyword: 'Then',
              text: 'I see file nodes',
              line: 7
            },
            {
              keyword: 'And',
              text: 'I see edges',
              line: 8
            }
          ]
        }
      ]
    });
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
