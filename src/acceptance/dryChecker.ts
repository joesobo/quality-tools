import type { AcceptanceIrDocument, AcceptanceIrScenario, AcceptanceIrStep } from './ir';

export type AcceptanceDryFindingKind =
  | 'duplicate-in-scenario'
  | 'exact-duplicate'
  | 'placeholder-variant'
  | 'repeated-step-pattern'
  | 'near-duplicate'
  | 'possible-synonym';

export interface AcceptanceDryFindingLocation {
  section: 'scenario';
  scenario_index: number;
  scenario_name: string;
  step_index: number;
  keyword: string;
  line: number;
}

export interface AcceptanceDryFindingMember {
  text: string;
  locations: AcceptanceDryFindingLocation[];
}

export interface AcceptanceDryFinding {
  kind: AcceptanceDryFindingKind;
  confidence: 'high' | 'medium' | 'low';
  canonical_candidate: string;
  pattern_candidate?: string;
  score?: number;
  members: AcceptanceDryFindingMember[];
  reason: string;
  suggested_action: string;
}

export interface AcceptanceDryReport {
  schema_version: 1;
  source_path: string;
  feature_name: string;
  summary: {
    scenarios: number;
    step_occurrences: number;
    unique_steps: number;
    repeated_step_patterns: number;
    repeated_scenario_shapes: number;
    findings: number;
  };
  repeated_scenario_shapes: AcceptanceDryScenarioShapeGroup[];
  findings: AcceptanceDryFinding[];
}

export interface AcceptanceDryScenarioShapeGroup {
  confidence: 'high' | 'medium';
  scenario_count: number;
  shared_step_count: number;
  pattern: string[];
  scenarios: Array<{
    scenario_index: number;
    scenario_name: string;
    line: number;
    examples: number;
  }>;
  reason: string;
  suggested_action: string;
}

interface StepOccurrence {
  step: AcceptanceIrStep;
  location: AcceptanceDryFindingLocation;
}

const NEAR_DUPLICATE_THRESHOLD = 0.72;
const POSSIBLE_SYNONYM_THRESHOLD = 0.45;
const IGNORED_TOKENS = new Set([
  'a',
  'an',
  'and',
  'are',
  'be',
  'i',
  'in',
  'is',
  'of',
  'the',
  'then',
  'to',
  'when'
]);

export function analyzeAcceptanceIrDryness(
  document: AcceptanceIrDocument,
  options: { includeExact?: boolean; includeSimilar?: boolean } = {}
): AcceptanceDryReport {
  const occurrences = document.scenarios.flatMap((scenario, scenarioIndex) =>
    scenario.steps.map((step, stepIndex) => ({
      step,
      location: createLocation(scenario, scenarioIndex, step, stepIndex)
    }))
  );
  const scenarioShapeGroups = findRepeatedScenarioShapes(document.scenarios);
  const repeatedStepPatterns = findRepeatedStepPatterns(occurrences);
  const findings = [
    ...findDuplicateInScenario(document.scenarios),
    ...(options.includeExact ? findExactDuplicates(occurrences) : []),
    ...findPlaceholderVariants(occurrences),
    ...repeatedStepPatterns,
    ...(options.includeSimilar ? findSimilarSteps(occurrences) : [])
  ];

  return {
    schema_version: 1,
    source_path: document.source_path,
    feature_name: document.feature.name,
    summary: {
      scenarios: document.scenarios.length,
      step_occurrences: occurrences.length,
      unique_steps: new Set(occurrences.map((occurrence) => occurrence.step.text)).size,
      repeated_step_patterns: repeatedStepPatterns.length,
      repeated_scenario_shapes: scenarioShapeGroups.length,
      findings: findings.length
    },
    repeated_scenario_shapes: scenarioShapeGroups,
    findings
  };
}

function findDuplicateInScenario(scenarios: AcceptanceIrScenario[]): AcceptanceDryFinding[] {
  return scenarios.flatMap((scenario, scenarioIndex) => {
    const groups = groupOccurrences(scenario.steps.map((step, stepIndex) => ({
      step,
      location: createLocation(scenario, scenarioIndex, step, stepIndex)
    })), (occurrence) => occurrence.step.text);

    return [...groups.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([text, members]) => createFinding({
        kind: 'duplicate-in-scenario',
        confidence: 'high',
        canonicalCandidate: text,
        members,
        reason: 'the same step text appears more than once in one scenario',
        suggestedAction: 'Review the scenario and remove the repeated step if it is accidental.'
      }));
  });
}

function findExactDuplicates(occurrences: StepOccurrence[]): AcceptanceDryFinding[] {
  return [...groupOccurrences(occurrences, (occurrence) => occurrence.step.text).entries()]
    .filter(([, members]) => members.length > 1)
    .map(([text, members]) => createFinding({
      kind: 'exact-duplicate',
      confidence: 'medium',
      canonicalCandidate: text,
      members,
      reason: 'the same step text appears more than once in the feature',
      suggestedAction: 'Keep repeated setup vocabulary when intentional; normalize only accidental drift.'
    }));
}

function findPlaceholderVariants(occurrences: StepOccurrence[]): AcceptanceDryFinding[] {
  return [...groupOccurrences(occurrences, (occurrence) => normalizePlaceholders(occurrence.step.text)).entries()]
    .filter(([, members]) => members.length > 1 && new Set(members.map((member) => member.step.text)).size > 1)
    .map(([text, members]) => createFinding({
      kind: 'placeholder-variant',
      confidence: 'high',
      canonicalCandidate: text,
      patternCandidate: patternFromPlaceholderText(text),
      members,
      reason: 'step text is identical after replacing placeholder names with generic slots',
      suggestedAction: 'Normalize the Gherkin if the different placeholder names do not add reader meaning.'
    }));
}

function findRepeatedStepPatterns(occurrences: StepOccurrence[]): AcceptanceDryFinding[] {
  return [...groupOccurrences(occurrences, (occurrence) => normalizeStepPattern(occurrence.step.text)).entries()]
    .filter(([, members]) => members.length > 1 && new Set(members.map((member) => member.step.text)).size > 1)
    .map(([pattern, members]) => createFinding({
      kind: 'repeated-step-pattern',
      confidence: 'high',
      canonicalCandidate: pattern,
      patternCandidate: pattern,
      members,
      reason: 'step text follows the same generalized pattern with different example values',
      suggestedAction: 'Consider a Scenario Outline, data table, or shared Background if the repeated shape is intentional.'
    }));
}

function findSimilarSteps(occurrences: StepOccurrence[]): AcceptanceDryFinding[] {
  const findings: AcceptanceDryFinding[] = [];

  occurrences.forEach((left, leftIndex) => {
    occurrences.slice(leftIndex + 1).forEach((right) => {
      if (left.step.text === right.step.text) {
        return;
      }

      if (normalizePlaceholders(left.step.text) === normalizePlaceholders(right.step.text)) {
        return;
      }

      const score = tokenSimilarity(left.step.text, right.step.text);
      if (score < POSSIBLE_SYNONYM_THRESHOLD) {
        return;
      }

      findings.push(createFinding({
        kind: score >= NEAR_DUPLICATE_THRESHOLD ? 'near-duplicate' : 'possible-synonym',
        confidence: score >= NEAR_DUPLICATE_THRESHOLD ? 'medium' : 'low',
        canonicalCandidate: left.step.text,
        members: [left, right],
        reason: 'step texts share similar normalized tokens',
        score: Number(score.toFixed(3)),
        suggestedAction: 'Review whether these steps express the same behavior before changing feature wording.'
      }));
    });
  });

  return findings;
}

function createLocation(
  scenario: AcceptanceIrScenario,
  scenarioIndex: number,
  step: AcceptanceIrStep,
  stepIndex: number
): AcceptanceDryFindingLocation {
  return {
    section: 'scenario',
    scenario_index: scenarioIndex,
    scenario_name: scenario.name,
    step_index: stepIndex,
    keyword: step.keyword,
    line: step.line
  };
}

function findRepeatedScenarioShapes(scenarios: AcceptanceIrScenario[]): AcceptanceDryScenarioShapeGroup[] {
  const exactShapeGroups = [...groupOccurrences(
    scenarios.map((scenario, scenarioIndex) => ({ scenario, scenarioIndex })),
    ({ scenario }) => scenario.steps.map((step) => normalizeStepPattern(step.text)).join('\n')
  ).entries()]
    .filter(([, members]) => members.length > 1)
    .map(([, members]) => createScenarioShapeGroup(members, members[0]?.scenario.steps.length ?? 0, 'high'));

  const prefixShapeGroups = [...groupOccurrences(
    scenarios.map((scenario, scenarioIndex) => ({
      scenario,
      scenarioIndex,
      prefix: longestSetupPrefix(scenario)
    })).filter((entry) => entry.prefix.length >= 3),
    ({ prefix }) => prefix.join('\n')
  ).entries()]
    .filter(([, members]) => members.length > 1)
    .map(([, members]) => createScenarioShapeGroup(members, members[0]?.prefix.length ?? 0, 'medium'));

  return dedupeScenarioShapeGroups([...exactShapeGroups, ...prefixShapeGroups]);
}

function createScenarioShapeGroup(
  members: Array<{ scenario: AcceptanceIrScenario; scenarioIndex: number; prefix?: string[] }>,
  sharedStepCount: number,
  confidence: AcceptanceDryScenarioShapeGroup['confidence']
): AcceptanceDryScenarioShapeGroup {
  const pattern = members[0]?.prefix ?? members[0]?.scenario.steps
    .slice(0, sharedStepCount)
    .map((step) => normalizeStepPattern(step.text)) ?? [];

  return {
    confidence,
    scenario_count: members.length,
    shared_step_count: sharedStepCount,
    pattern,
    scenarios: members.map(({ scenario, scenarioIndex }) => ({
      scenario_index: scenarioIndex,
      scenario_name: scenario.name,
      line: scenario.line,
      examples: scenario.examples.length
    })),
    reason: confidence === 'high'
      ? 'multiple scenarios have the same generalized step sequence'
      : 'multiple scenarios share the same setup or action prefix before diverging into specific assertions',
    suggested_action: confidence === 'high'
      ? 'Consider collapsing these scenarios into a Scenario Outline or a data-driven runner.'
      : 'Consider moving the shared prefix into Background or a host fixture if it does not need to be repeated in every scenario.'
  };
}

function longestSetupPrefix(scenario: AcceptanceIrScenario): string[] {
  const normalizedSteps = scenario.steps.map((step) => normalizeStepPattern(step.text));
  const assertionIndex = scenario.steps.findIndex((step) => step.keyword === 'Then');
  const prefixLength = assertionIndex === -1 ? normalizedSteps.length : assertionIndex;
  return normalizedSteps.slice(0, prefixLength);
}

function dedupeScenarioShapeGroups(groups: AcceptanceDryScenarioShapeGroup[]): AcceptanceDryScenarioShapeGroup[] {
  const seen = new Set<string>();
  const sorted = groups.sort((left, right) =>
    right.scenario_count - left.scenario_count ||
    right.shared_step_count - left.shared_step_count ||
    left.confidence.localeCompare(right.confidence)
  );

  return sorted.filter((group) => {
    const scenarioKey = group.scenarios.map((scenario) => scenario.scenario_index).join(',');
    const key = `${scenarioKey}:${group.shared_step_count}:${group.pattern.join('\n')}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function createFinding(input: {
  kind: AcceptanceDryFindingKind;
  confidence: AcceptanceDryFinding['confidence'];
  canonicalCandidate: string;
  patternCandidate?: string;
  score?: number;
  members: StepOccurrence[];
  reason: string;
  suggestedAction: string;
}): AcceptanceDryFinding {
  return {
    kind: input.kind,
    confidence: input.confidence,
    canonical_candidate: input.canonicalCandidate,
    ...(input.patternCandidate ? { pattern_candidate: input.patternCandidate } : {}),
    ...(input.score === undefined ? {} : { score: input.score }),
    members: [...groupOccurrences(input.members, (member) => member.step.text).entries()].map(([text, members]) => ({
      text,
      locations: members.map((member) => member.location)
    })),
    reason: input.reason,
    suggested_action: input.suggestedAction
  };
}

function groupOccurrences<T>(values: T[], keySelector: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  values.forEach((value) => {
    const key = keySelector(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  });

  return groups;
}

function normalizePlaceholders(text: string): string {
  let index = 0;
  return text.replace(/<[^>]+>/g, () => {
    index += 1;
    return `<_${index}>`;
  });
}

function normalizeStepPattern(text: string): string {
  return normalizePlaceholders(text)
    .replace(/\b\d+\b/g, '<number>')
    .replace(/\bexamples\/[A-Za-z0-9_-]+\b/g, '<workspace>')
    .replace(/\b[A-Za-z0-9._/-]+\.[A-Za-z0-9]+\b/g, '<path>')
    .replace(/\b(File|Folder|Package|Symbol|Namespace|Function|Callable|Method|Constructor|Prototype|Class|Interface|Record|Delegate|Property|Event|Type|Struct|Union|Enum|Alias|Template|Typedef|Variable|Constant|Global|Field|Parameter|Local|Godot class_name)\b/g, '<node-type>')
    .replace(/\b(Include|Imports|References|Calls|Type imports|Inherits|Using|Call|Implements|Loads|Nests|Contains|Overrides|TypeScript Alias Import)\b/g, '<edge-type>')
    .replace(/\s+/g, ' ')
    .trim();
}

function patternFromPlaceholderText(text: string): string {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^${escaped.replace(/<_[0-9]+>/g, '(.+)')}$`;
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const union = new Set([...leftTokens, ...rightTokens]);

  if (union.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  return intersection.length / union.size;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length > 0 && !IGNORED_TOKENS.has(token))
  );
}
