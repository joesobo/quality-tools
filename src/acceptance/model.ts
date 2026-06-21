export type AcceptanceStepKeyword = 'Given' | 'When' | 'Then' | 'And' | 'But';

export interface AcceptanceFeature {
  name: string;
  line: number;
}

export interface AcceptanceStep {
  keyword: AcceptanceStepKeyword;
  text: string;
  line: number;
  parameters: string[];
}

export interface AcceptanceBackground {
  line: number;
  steps: AcceptanceStep[];
}

export interface AcceptanceExampleRow {
  line: number;
  values: Record<string, string>;
}

export interface AcceptanceScenario {
  name: string;
  line: number;
  steps: AcceptanceStep[];
  examples: AcceptanceExampleRow[];
}

export interface AcceptanceDocument {
  sourcePath: string;
  feature: AcceptanceFeature;
  background?: AcceptanceBackground;
  scenarios: AcceptanceScenario[];
}
