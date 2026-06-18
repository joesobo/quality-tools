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

export function parseAcceptanceMarkdown(markdown: string, sourcePath: string): AcceptanceDocument {
  const lines = markdown.split(/\r?\n/);
  let feature: AcceptanceFeature | undefined;
  let background: AcceptanceBackground | undefined;
  const scenarios: AcceptanceScenario[] = [];
  const scenariosWithExamples = new Set<AcceptanceScenario>();
  let stepTarget: AcceptanceBackground | AcceptanceScenario | undefined;
  let examplesTarget: AcceptanceScenario | undefined;
  let examplesHeaders: string[] | undefined;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (line === '') {
      return;
    }

    const featureMatch = FEATURE_PATTERN.exec(line);
    if (featureMatch) {
      feature = {
        name: featureMatch[1].trim(),
        line: lineNumber
      };
      stepTarget = undefined;
      examplesTarget = undefined;
      examplesHeaders = undefined;
      return;
    }

    if (BACKGROUND_PATTERN.test(line)) {
      if (background) {
        throw new Error(`${sourcePath}:${lineNumber} Feature has more than one Background`);
      }

      background = {
        line: lineNumber,
        steps: []
      };
      stepTarget = background;
      examplesTarget = undefined;
      examplesHeaders = undefined;
      return;
    }

    const scenarioMatch = SCENARIO_PATTERN.exec(line) ?? SCENARIO_OUTLINE_PATTERN.exec(line);
    if (scenarioMatch) {
      const scenario: AcceptanceScenario = {
        name: scenarioMatch[1].trim(),
        line: lineNumber,
        steps: [],
        examples: []
      };
      scenarios.push(scenario);
      stepTarget = scenario;
      examplesTarget = undefined;
      examplesHeaders = undefined;
      return;
    }

    if (EXAMPLES_PATTERN.test(line)) {
      const scenario = scenarios.at(-1);
      if (!scenario) {
        throw new Error(`${sourcePath}:${lineNumber} Examples appear before a Scenario`);
      }

      examplesTarget = scenario;
      scenariosWithExamples.add(scenario);
      stepTarget = undefined;
      examplesHeaders = undefined;
      return;
    }

    if (line.startsWith('|')) {
      if (!examplesTarget) {
        return;
      }

      const values = parseExamplesRow(line);
      if (!examplesHeaders) {
        examplesHeaders = values;
        if (examplesHeaders.length === 0) {
          throw new Error(`${sourcePath}:${lineNumber} Examples header must contain at least one column`);
        }
        return;
      }

      if (values.length !== examplesHeaders.length) {
        throw new Error(`${sourcePath}:${lineNumber} Examples row has ${values.length} cells; expected ${examplesHeaders.length}`);
      }

      examplesTarget.examples.push({
        line: lineNumber,
        values: Object.fromEntries(examplesHeaders.map((header, cellIndex) => [header, values[cellIndex] ?? '']))
      });
      return;
    }

    const stepMatch = STEP_PATTERN.exec(line);
    if (stepMatch) {
      if (!stepTarget) {
        throw new Error(`${sourcePath}:${lineNumber} Step appears before a Scenario or Background`);
      }

      stepTarget.steps.push({
        keyword: stepMatch[1] as AcceptanceStepKeyword,
        text: stepMatch[2].trim(),
        line: lineNumber,
        parameters: extractParameters(stepMatch[2].trim())
      });
    }
  });

  if (!feature) {
    throw new Error(`${sourcePath}: Expected a Feature heading`);
  }

  if (scenarios.length === 0) {
    throw new Error(`${sourcePath}: Expected at least one Scenario`);
  }

  if (background && background.steps.length === 0) {
    throw new Error(`${sourcePath}:${background.line} Background must contain at least one step`);
  }

  const emptyScenario = scenarios.find((scenario) => scenario.steps.length === 0);
  if (emptyScenario) {
    throw new Error(`${sourcePath}:${emptyScenario.line} Scenario "${emptyScenario.name}" must contain at least one step`);
  }

  const emptyExamples = scenarios.find((scenario) => scenariosWithExamples.has(scenario) && scenario.examples.length === 0);
  if (emptyExamples) {
    throw new Error(`${sourcePath}:${emptyExamples.line} Scenario "${emptyExamples.name}" has Examples without rows`);
  }

  return {
    sourcePath,
    feature,
    ...(background ? { background } : {}),
    scenarios
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
