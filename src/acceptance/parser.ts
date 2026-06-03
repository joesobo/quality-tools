import type {
  AcceptanceDocument,
  AcceptanceFeature,
  AcceptanceScenario,
  AcceptanceStepKeyword
} from './model';

const FEATURE_PATTERN = /^#{0,6}\s*Feature:\s*(.+)$/;
const SCENARIO_PATTERN = /^#{0,6}\s*Scenario:\s*(.+)$/;
const STEP_PATTERN = /^(Given|When|Then|And|But)\s+(.+)$/;

export function parseAcceptanceMarkdown(markdown: string, sourcePath: string): AcceptanceDocument {
  const lines = markdown.split(/\r?\n/);
  let feature: AcceptanceFeature | undefined;
  const scenarios: AcceptanceScenario[] = [];

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
      return;
    }

    const scenarioMatch = SCENARIO_PATTERN.exec(line);
    if (scenarioMatch) {
      scenarios.push({
        name: scenarioMatch[1].trim(),
        line: lineNumber,
        steps: []
      });
      return;
    }

    const stepMatch = STEP_PATTERN.exec(line);
    if (stepMatch) {
      const scenario = scenarios.at(-1);
      if (!scenario) {
        throw new Error(`${sourcePath}:${lineNumber} Step appears before a Scenario`);
      }

      scenario.steps.push({
        keyword: stepMatch[1] as AcceptanceStepKeyword,
        text: stepMatch[2].trim(),
        line: lineNumber
      });
    }
  });

  if (!feature) {
    throw new Error(`${sourcePath}: Expected a Feature heading`);
  }

  if (scenarios.length === 0) {
    throw new Error(`${sourcePath}: Expected at least one Scenario`);
  }

  const emptyScenario = scenarios.find((scenario) => scenario.steps.length === 0);
  if (emptyScenario) {
    throw new Error(`${sourcePath}:${emptyScenario.line} Scenario "${emptyScenario.name}" must contain at least one step`);
  }

  return {
    sourcePath,
    feature,
    scenarios
  };
}
