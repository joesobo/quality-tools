import type { AcceptanceDocument, AcceptanceScenario, AcceptanceStep } from './model';

export type AcceptanceDryFindingKind =
  | 'duplicate-in-scenario'
  | 'exact-duplicate'
  | 'placeholder-variant'
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
  feature_name: string;
  summary: {
    step_occurrences: number;
    unique_steps: number;
    findings: number;
  };
  findings: AcceptanceDryFinding[];
}

interface StepOccurrence {
  step: AcceptanceStep;
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
  document: AcceptanceDocument,
  options: { includeExact?: boolean } = {}
): AcceptanceDryReport {
  const occurrences = document.scenarios.flatMap((scenario, scenarioIndex) =>
    scenario.steps.map((step, stepIndex) => ({
      step,
      location: createLocation(scenario, scenarioIndex, step, stepIndex)
    }))
  );
  const findings = [
    ...findDuplicateInScenario(document.scenarios),
    ...(options.includeExact ? findExactDuplicates(occurrences) : []),
    ...findPlaceholderVariants(occurrences),
    ...findSimilarSteps(occurrences)
  ];

  return {
    schema_version: 1,
    feature_name: document.feature.name,
    summary: {
      step_occurrences: occurrences.length,
      unique_steps: new Set(occurrences.map((occurrence) => occurrence.step.text)).size,
      findings: findings.length
    },
    findings
  };
}

function findDuplicateInScenario(scenarios: AcceptanceScenario[]): AcceptanceDryFinding[] {
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
  scenario: AcceptanceScenario,
  scenarioIndex: number,
  step: AcceptanceStep,
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
