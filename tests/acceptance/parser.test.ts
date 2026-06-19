import { describe, expect, it } from 'vitest';
import { parseAcceptanceFeature } from '../../src/acceptance/parser';

describe('acceptance feature parser', () => {
  it('parses a feature with one scenario and ordered steps', () => {
    const document = parseAcceptanceFeature(
      `Feature: Graph View

Scenario: Indexing shows graph progress

Given I open the example workspace
When I open the graph view
Then I see file nodes
And I see edges
`,
      'tests/acceptance/specs/graph-view.feature'
    );

    expect(document).toEqual({
      sourcePath: 'tests/acceptance/specs/graph-view.feature',
      feature: {
        name: 'Graph View',
        line: 1
      },
      scenarios: [
        {
          name: 'Indexing shows graph progress',
          line: 3,
          examples: [],
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
    const document = parseAcceptanceFeature(
      `Feature: Graph View

Scenario: Open a workspace

Given I open the <workspace> workspace
Then <node_name> is visible in <workspace>
`,
      'tests/acceptance/specs/graph-view.feature'
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

  it('parses background steps and scenario outline examples', () => {
    const document = parseAcceptanceFeature(
      `Feature: Checkout

Background:
Given I open the store

Scenario Outline: Calculate totals
When I add <item>
Then the total is <total>

Examples:
| item | total |
| book | 12 |
| pen | 3 |
`,
      'features/checkout.feature'
    );

    expect(document).toMatchObject({
      sourcePath: 'features/checkout.feature',
      feature: {
        name: 'Checkout',
        line: 1
      },
      background: {
        line: 3,
        steps: [
          expect.objectContaining({
            keyword: 'Given',
            text: 'I open the store',
            line: 4
          })
        ]
      },
      scenarios: [
        {
          name: 'Calculate totals',
          line: 6,
          steps: [
            expect.objectContaining({
              text: 'I add <item>',
              parameters: ['item']
            }),
            expect.objectContaining({
              text: 'the total is <total>',
              parameters: ['total']
            })
          ],
          examples: [
            {
              line: 12,
              values: {
                item: 'book',
                total: '12'
              }
            },
            {
              line: 13,
              values: {
                item: 'pen',
                total: '3'
              }
            }
          ]
        }
      ]
    });
  });

  it('rejects a feature without scenarios', () => {
    expect(() => parseAcceptanceFeature(
      'Feature: Graph View\n',
      'tests/acceptance/specs/graph-view.feature'
    )).toThrow('tests/acceptance/specs/graph-view.feature: Expected at least one Scenario');
  });

  it('rejects a scenario without steps', () => {
    expect(() => parseAcceptanceFeature(
      `Feature: Graph View

Scenario: Empty scenario
`,
      'tests/acceptance/specs/graph-view.feature'
    )).toThrow('tests/acceptance/specs/graph-view.feature:3 Scenario "Empty scenario" must contain at least one step');
  });
});
