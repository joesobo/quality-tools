export type AcceptanceStepKeyword = 'Given' | 'When' | 'Then' | 'And' | 'But';

export interface AcceptanceFeature {
  name: string;
  line: number;
}

export interface AcceptanceStep {
  keyword: AcceptanceStepKeyword;
  text: string;
  line: number;
}

export interface AcceptanceScenario {
  name: string;
  line: number;
  steps: AcceptanceStep[];
}

export interface AcceptanceDocument {
  sourcePath: string;
  feature: AcceptanceFeature;
  scenarios: AcceptanceScenario[];
}
