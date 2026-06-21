import type {
  AcceptanceBackground,
  AcceptanceDocument,
  AcceptanceFeature,
  AcceptanceScenario,
  AcceptanceStepKeyword
} from './model';

const FEATURE_PATTERN = /^#{0,6}\s*Feature:\s*(.+)$/;
const BACKGROUND_PATTERN = /^#{0,6}\s*Background:\s*$/;
const SCENARIO_PATTERN = /^#{0,6}\s*Scenario:\s*(.+)$/;
const SCENARIO_OUTLINE_PATTERN = /^#{0,6}\s*Scenario Outline:\s*(.+)$/;
const EXAMPLES_PATTERN = /^#{0,6}\s*Examples:\s*$/;
const STEP_PATTERN = /^(Given|When|Then|And|But)\s+(.+)$/;
const PARAMETER_PATTERN = /<([A-Za-z0-9_]+)>/g;

interface ParserState {
  sourcePath: string;
  feature?: AcceptanceFeature;
  background?: AcceptanceBackground;
  scenarios: AcceptanceScenario[];
  scenariosWithExamples: Set<AcceptanceScenario>;
  stepTarget?: AcceptanceBackground | AcceptanceScenario;
  examplesTarget?: AcceptanceScenario;
  examplesHeaders?: string[];
}

type LineParser = (state: ParserState, line: string, lineNumber: number) => boolean;

const LINE_PARSERS: LineParser[] = [
  parseFeatureHeading,
  parseBackgroundHeading,
  parseScenarioHeading,
  parseExamplesHeading,
  parseExamplesRowLine,
  parseStepLine
];

export function parseAcceptanceFeature(featureSource: string, sourcePath: string): AcceptanceDocument {
  const state = createParserState(sourcePath);
  parseFeatureLines(state, featureSource);
  validateDocument(state);
  return createDocument(state);
}

function createParserState(sourcePath: string): ParserState {
  return {
    sourcePath,
    scenarios: [],
    scenariosWithExamples: new Set<AcceptanceScenario>()
  };
}

function parseFeatureLines(state: ParserState, featureSource: string): void {
  featureSource.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    parseFeatureLine(state, line, lineNumber);
  });
}

function parseFeatureLine(state: ParserState, line: string, lineNumber: number): void {
  if (line === '') {
    return;
  }

  for (const parseLine of LINE_PARSERS) {
    if (parseLine(state, line, lineNumber)) {
      return;
    }
  }
}

function parseFeatureHeading(state: ParserState, line: string, lineNumber: number): boolean {
  const featureMatch = FEATURE_PATTERN.exec(line);
  if (!featureMatch) {
    return false;
  }

  state.feature = {
    name: featureMatch[1].trim(),
    line: lineNumber
  };
  clearActiveTargets(state);
  return true;
}

function parseBackgroundHeading(state: ParserState, line: string, lineNumber: number): boolean {
  if (!BACKGROUND_PATTERN.test(line)) {
    return false;
  }

  if (state.background) {
    throw new Error(`${state.sourcePath}:${lineNumber} Feature has more than one Background`);
  }

  state.background = {
    line: lineNumber,
    steps: []
  };
  state.stepTarget = state.background;
  clearExamplesTarget(state);
  return true;
}

function parseScenarioHeading(state: ParserState, line: string, lineNumber: number): boolean {
  const scenarioMatch = SCENARIO_PATTERN.exec(line) ?? SCENARIO_OUTLINE_PATTERN.exec(line);
  if (!scenarioMatch) {
    return false;
  }

  const scenario: AcceptanceScenario = {
    name: scenarioMatch[1].trim(),
    line: lineNumber,
    steps: [],
    examples: []
  };
  state.scenarios.push(scenario);
  state.stepTarget = scenario;
  clearExamplesTarget(state);
  return true;
}

function parseExamplesHeading(state: ParserState, line: string, lineNumber: number): boolean {
  if (!EXAMPLES_PATTERN.test(line)) {
    return false;
  }

  const scenario = state.scenarios.at(-1);
  if (!scenario) {
    throw new Error(`${state.sourcePath}:${lineNumber} Examples appear before a Scenario`);
  }

  state.examplesTarget = scenario;
  state.scenariosWithExamples.add(scenario);
  state.stepTarget = undefined;
  state.examplesHeaders = undefined;
  return true;
}

function parseExamplesRowLine(state: ParserState, line: string, lineNumber: number): boolean {
  if (!line.startsWith('|')) {
    return false;
  }

  if (!state.examplesTarget) {
    return true;
  }

  const values = parseExamplesRow(line);
  if (!state.examplesHeaders) {
    setExamplesHeaders(state, values, lineNumber);
    return true;
  }

  if (values.length !== state.examplesHeaders.length) {
    throw new Error(`${state.sourcePath}:${lineNumber} Examples row has ${values.length} cells; expected ${state.examplesHeaders.length}`);
  }

  state.examplesTarget.examples.push({
    line: lineNumber,
    values: Object.fromEntries(state.examplesHeaders.map((header, cellIndex) => [header, values[cellIndex] ?? '']))
  });
  return true;
}

function setExamplesHeaders(state: ParserState, values: string[], lineNumber: number): void {
  state.examplesHeaders = values;
  if (state.examplesHeaders.length === 0) {
    throw new Error(`${state.sourcePath}:${lineNumber} Examples header must contain at least one column`);
  }
}

function parseStepLine(state: ParserState, line: string, lineNumber: number): boolean {
  const stepMatch = STEP_PATTERN.exec(line);
  if (!stepMatch) {
    return false;
  }

  if (!state.stepTarget) {
    throw new Error(`${state.sourcePath}:${lineNumber} Step appears before a Scenario or Background`);
  }

  const text = stepMatch[2].trim();
  state.stepTarget.steps.push({
    keyword: stepMatch[1] as AcceptanceStepKeyword,
    text,
    line: lineNumber,
    parameters: extractParameters(text)
  });
  return true;
}

function clearActiveTargets(state: ParserState): void {
  state.stepTarget = undefined;
  clearExamplesTarget(state);
}

function clearExamplesTarget(state: ParserState): void {
  state.examplesTarget = undefined;
  state.examplesHeaders = undefined;
}

function validateDocument(state: ParserState): asserts state is ParserState & { feature: AcceptanceFeature } {
  assertFeatureExists(state);
  assertHasScenarios(state);
  assertBackgroundHasSteps(state);
  assertScenariosHaveSteps(state);
  assertExamplesHaveRows(state);
}

function assertFeatureExists(state: ParserState): asserts state is ParserState & { feature: AcceptanceFeature } {
  if (!state.feature) {
    throw new Error(`${state.sourcePath}: Expected a Feature heading`);
  }
}

function assertHasScenarios(state: ParserState): void {
  if (state.scenarios.length === 0) {
    throw new Error(`${state.sourcePath}: Expected at least one Scenario`);
  }
}

function assertBackgroundHasSteps(state: ParserState): void {
  if (state.background && state.background.steps.length === 0) {
    throw new Error(`${state.sourcePath}:${state.background.line} Background must contain at least one step`);
  }
}

function assertScenariosHaveSteps(state: ParserState): void {
  const emptyScenario = state.scenarios.find((scenario) => scenario.steps.length === 0);
  if (emptyScenario) {
    throw new Error(`${state.sourcePath}:${emptyScenario.line} Scenario "${emptyScenario.name}" must contain at least one step`);
  }
}

function assertExamplesHaveRows(state: ParserState): void {
  const emptyExamples = state.scenarios.find((scenario) =>
    state.scenariosWithExamples.has(scenario) && scenario.examples.length === 0
  );
  if (emptyExamples) {
    throw new Error(`${state.sourcePath}:${emptyExamples.line} Scenario "${emptyExamples.name}" has Examples without rows`);
  }
}

function createDocument(state: ParserState & { feature: AcceptanceFeature }): AcceptanceDocument {
  return {
    sourcePath: state.sourcePath,
    feature: state.feature,
    ...(state.background ? { background: state.background } : {}),
    scenarios: state.scenarios
  };
}

function extractParameters(text: string): string[] {
  return [...text.matchAll(PARAMETER_PATTERN)].map((match) => match[1] ?? '');
}

function parseExamplesRow(line: string): string[] {
  return line
    .slice(1, line.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim());
}
