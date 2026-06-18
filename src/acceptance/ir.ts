import type { AcceptanceDocument } from './model';

export interface AcceptanceIrStep {
  keyword: string;
  text: string;
  line: number;
  parameters: string[];
}

export interface AcceptanceIrScenario {
  name: string;
  line: number;
  steps: AcceptanceIrStep[];
}

export interface AcceptanceIrDocument {
  schema_version: 1;
  source_path: string;
  feature: {
    name: string;
    line: number;
  };
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
    scenarios: document.scenarios.map((scenario) => ({
      name: scenario.name,
      line: scenario.line,
      steps: scenario.steps.map((step) => ({
        keyword: step.keyword,
        text: step.text,
        line: step.line,
        parameters: step.parameters
      }))
    }))
  };
}
