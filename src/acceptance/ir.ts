import type { AcceptanceDocument } from './model';

export interface AcceptanceIrStep {
  keyword: string;
  text: string;
  line: number;
  parameters: string[];
}

export interface AcceptanceIrBackground {
  line: number;
  steps: AcceptanceIrStep[];
}

export interface AcceptanceIrExampleRow {
  line: number;
  values: Record<string, string>;
}

export interface AcceptanceIrScenario {
  name: string;
  line: number;
  steps: AcceptanceIrStep[];
  examples: AcceptanceIrExampleRow[];
}

export interface AcceptanceIrDocument {
  schema_version: 1;
  source_path: string;
  feature: {
    name: string;
    line: number;
  };
  background?: AcceptanceIrBackground;
  scenarios: AcceptanceIrScenario[];
}

export function toAcceptanceIr(document: AcceptanceDocument): AcceptanceIrDocument {
  return {
    schema_version: 1,
    source_path: document.sourcePath,
    feature: {
      name: document.feature.name,
      line: document.feature.line
    },
    ...(document.background ? {
      background: {
        line: document.background.line,
        steps: document.background.steps.map(toAcceptanceIrStep)
      }
    } : {}),
    scenarios: document.scenarios.map((scenario) => ({
      name: scenario.name,
      line: scenario.line,
      steps: scenario.steps.map(toAcceptanceIrStep),
      examples: scenario.examples.map((example) => ({
        line: example.line,
        values: example.values
      }))
    }))
  };
}

function toAcceptanceIrStep(documentStep: AcceptanceDocument['scenarios'][number]['steps'][number]): AcceptanceIrStep {
  return {
    keyword: documentStep.keyword,
    text: documentStep.text,
    line: documentStep.line,
    parameters: documentStep.parameters
  };
}
