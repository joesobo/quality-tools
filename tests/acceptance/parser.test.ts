import { describe, expect, it } from 'vitest';
import { parseAcceptanceFeature } from '../../src/acceptance/parser';

const GRAPH_VIEW_SOURCE_PATH = 'tests/acceptance/specs/graph-view.feature';

describe('acceptance feature parser', () => {
  it.each([
    {
      name: 'a feature with one scenario and ordered steps',
      sourcePath: GRAPH_VIEW_SOURCE_PATH,
      source: `Feature: Graph View

Scenario: Indexing shows graph progress

Given I open the example workspace
When I open the graph view
Then I see file nodes
And I see edges
`,
      expected: {
        sourcePath: GRAPH_VIEW_SOURCE_PATH,
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
      }
    },
    {
      name: 'placeholder parameters from step text',
      sourcePath: GRAPH_VIEW_SOURCE_PATH,
      source: `Feature: Graph View

Scenario: Open a workspace

Given I open the <workspace> workspace
Then <node_name> is visible in <workspace>
`,
      expected: {
        scenarios: [
          {
            steps: [
              expect.objectContaining({
                text: 'I open the <workspace> workspace',
                parameters: ['workspace']
              }),
              expect.objectContaining({
                text: '<node_name> is visible in <workspace>',
                parameters: ['node_name', 'workspace']
              })
            ]
          }
        ]
      }
    },
    {
      name: 'background steps and scenario outline examples',
      sourcePath: 'features/checkout.feature',
      source: `Feature: Checkout

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
      expected: {
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
      }
    }
  ])('parses $name', ({ source, sourcePath, expected }) => {
    const document = parseAcceptanceFeature(
      source,
      sourcePath
    );

    expect(document).toMatchObject(expected);
  });

  it.each([
    {
      name: 'a feature without scenarios',
      source: 'Feature: Graph View\n',
      message: `${GRAPH_VIEW_SOURCE_PATH}: Expected at least one Scenario`
    },
    {
      name: 'a scenario without steps',
      source: `Feature: Graph View

Scenario: Empty scenario
`,
      message: `${GRAPH_VIEW_SOURCE_PATH}:3 Scenario "Empty scenario" must contain at least one step`
    }
  ])('rejects $name', ({ source, message }) => {
    expect(() => parseAcceptanceFeature(
      source,
      GRAPH_VIEW_SOURCE_PATH
    )).toThrow(message);
  });
});
