#!/usr/bin/env node

// src/acceptance/command.ts
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

// src/acceptance/dryChecker.ts
var NEAR_DUPLICATE_THRESHOLD = 0.72;
var POSSIBLE_SYNONYM_THRESHOLD = 0.45;
var IGNORED_TOKENS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "i",
  "in",
  "is",
  "of",
  "the",
  "then",
  "to",
  "when"
]);
function analyzeAcceptanceIrDryness(document, options = {}) {
  const occurrences = document.scenarios.flatMap(
    (scenario, scenarioIndex) => scenario.steps.map((step, stepIndex) => ({
      step,
      location: createLocation(scenario, scenarioIndex, step, stepIndex)
    }))
  );
  const findings = [
    ...findDuplicateInScenario(document.scenarios),
    ...options.includeExact ? findExactDuplicates(occurrences) : [],
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
function findDuplicateInScenario(scenarios) {
  return scenarios.flatMap((scenario, scenarioIndex) => {
    const groups = groupOccurrences(scenario.steps.map((step, stepIndex) => ({
      step,
      location: createLocation(scenario, scenarioIndex, step, stepIndex)
    })), (occurrence) => occurrence.step.text);
    return [...groups.entries()].filter(([, members]) => members.length > 1).map(([text, members]) => createFinding({
      kind: "duplicate-in-scenario",
      confidence: "high",
      canonicalCandidate: text,
      members,
      reason: "the same step text appears more than once in one scenario",
      suggestedAction: "Review the scenario and remove the repeated step if it is accidental."
    }));
  });
}
function findExactDuplicates(occurrences) {
  return [...groupOccurrences(occurrences, (occurrence) => occurrence.step.text).entries()].filter(([, members]) => members.length > 1).map(([text, members]) => createFinding({
    kind: "exact-duplicate",
    confidence: "medium",
    canonicalCandidate: text,
    members,
    reason: "the same step text appears more than once in the feature",
    suggestedAction: "Keep repeated setup vocabulary when intentional; normalize only accidental drift."
  }));
}
function findPlaceholderVariants(occurrences) {
  return [...groupOccurrences(occurrences, (occurrence) => normalizePlaceholders(occurrence.step.text)).entries()].filter(([, members]) => members.length > 1 && new Set(members.map((member) => member.step.text)).size > 1).map(([text, members]) => createFinding({
    kind: "placeholder-variant",
    confidence: "high",
    canonicalCandidate: text,
    patternCandidate: patternFromPlaceholderText(text),
    members,
    reason: "step text is identical after replacing placeholder names with generic slots",
    suggestedAction: "Normalize the Gherkin if the different placeholder names do not add reader meaning."
  }));
}
function findSimilarSteps(occurrences) {
  const findings = [];
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
        kind: score >= NEAR_DUPLICATE_THRESHOLD ? "near-duplicate" : "possible-synonym",
        confidence: score >= NEAR_DUPLICATE_THRESHOLD ? "medium" : "low",
        canonicalCandidate: left.step.text,
        members: [left, right],
        reason: "step texts share similar normalized tokens",
        score: Number(score.toFixed(3)),
        suggestedAction: "Review whether these steps express the same behavior before changing feature wording."
      }));
    });
  });
  return findings;
}
function createLocation(scenario, scenarioIndex, step, stepIndex) {
  return {
    section: "scenario",
    scenario_index: scenarioIndex,
    scenario_name: scenario.name,
    step_index: stepIndex,
    keyword: step.keyword,
    line: step.line
  };
}
function createFinding(input) {
  return {
    kind: input.kind,
    confidence: input.confidence,
    canonical_candidate: input.canonicalCandidate,
    ...input.patternCandidate ? { pattern_candidate: input.patternCandidate } : {},
    ...input.score === void 0 ? {} : { score: input.score },
    members: [...groupOccurrences(input.members, (member) => member.step.text).entries()].map(([text, members]) => ({
      text,
      locations: members.map((member) => member.location)
    })),
    reason: input.reason,
    suggested_action: input.suggestedAction
  };
}
function groupOccurrences(values, keySelector) {
  const groups = /* @__PURE__ */ new Map();
  values.forEach((value) => {
    const key = keySelector(value);
    groups.set(key, [...groups.get(key) ?? [], value]);
  });
  return groups;
}
function normalizePlaceholders(text) {
  let index = 0;
  return text.replace(/<[^>]+>/g, () => {
    index += 1;
    return `<_${index}>`;
  });
}
function patternFromPlaceholderText(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^${escaped.replace(/<_[0-9]+>/g, "(.+)")}$`;
}
function tokenSimilarity(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const union = /* @__PURE__ */ new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) {
    return 0;
  }
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  return intersection.length / union.size;
}
function tokenize(text) {
  return new Set(
    text.replace(/<[^>]+>/g, " ").toLowerCase().split(/[^a-z0-9]+/u).filter((token) => token.length > 0 && !IGNORED_TOKENS.has(token))
  );
}

// src/acceptance/ir.ts
function toAcceptanceIr(document) {
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

// src/acceptance/parser.ts
var FEATURE_PATTERN = /^#{0,6}\s*Feature:\s*(.+)$/;
var SCENARIO_PATTERN = /^#{0,6}\s*Scenario:\s*(.+)$/;
var STEP_PATTERN = /^(Given|When|Then|And|But)\s+(.+)$/;
var PARAMETER_PATTERN = /<([A-Za-z0-9_]+)>/g;
function parseAcceptanceMarkdown(markdown, sourcePath) {
  const lines = markdown.split(/\r?\n/);
  let feature;
  const scenarios = [];
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "") {
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
        keyword: stepMatch[1],
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
function extractParameters(text) {
  return [...text.matchAll(PARAMETER_PATTERN)].map((match) => match[1] ?? "");
}

// src/acceptance/playwright/generator.ts
function generatePlaywrightAcceptanceSpec(documents, options) {
  const sections = documents.flatMap((document) => generateDocumentSections(document));
  return [
    "/* Generated by quality-tools acceptance compile. Do not edit. */",
    "/* eslint-disable playwright/expect-expect */",
    "import { test } from '@playwright/test';",
    `import { acceptanceSteps, createAcceptanceContext } from ${quote(options.stepsImportPath)};`,
    "",
    "type AcceptanceContext = Awaited<ReturnType<typeof createAcceptanceContext>> & { cleanup?: () => unknown | Promise<unknown> };",
    "type AcceptanceRuntimeStep = { keyword: string; text: string; sourcePath: string; line: number };",
    "type AcceptanceStepImplementation = (context: AcceptanceContext, step: AcceptanceRuntimeStep) => unknown | Promise<unknown>;",
    "type AcceptanceStepRegistry = Record<string, AcceptanceStepImplementation>;",
    "",
    "async function runAcceptanceStep(",
    "  context: AcceptanceContext,",
    "  stepText: string,",
    "  step: AcceptanceRuntimeStep",
    "): Promise<void> {",
    "  const registry = acceptanceSteps as AcceptanceStepRegistry;",
    "  const implementation = registry[stepText] ?? registry[`${step.keyword} ${stepText}`];",
    "",
    "  if (!implementation) {",
    '    throw new Error(`Missing acceptance step "${step.keyword} ${step.text}" at ${step.sourcePath}:${step.line}`);',
    "  }",
    "",
    "  await implementation(context, step);",
    "}",
    "",
    ...sections,
    ""
  ].join("\n");
}
function generateDocumentSections(document) {
  const scenarios = document.scenarios.flatMap((scenario) => generateScenario(document.sourcePath, scenario));
  return [
    `test.describe(${quote(document.feature.name)}, () => {`,
    ...indentLines(scenarios, 2),
    "});",
    ""
  ];
}
function generateScenario(sourcePath, scenario) {
  const steps = indentLines(scenario.steps.flatMap((step) => generateStep(sourcePath, step)), 4);
  return [
    `test(${quote(scenario.name)}, async ({}, testInfo) => {`,
    "  const context = await createAcceptanceContext({",
    "    testInfo,",
    `    sourcePath: ${quote(sourcePath)},`,
    `    scenario: ${quote(scenario.name)}`,
    "  });",
    "",
    "  try {",
    ...steps,
    "  } finally {",
    "    await context.cleanup?.();",
    "  }",
    "});"
  ];
}
function generateStep(sourcePath, step) {
  const label = `${step.keyword} ${step.text}`;
  return [
    `// ${sourcePath}:${step.line}`,
    `await test.step(${quote(label)}, async () => {`,
    `  await runAcceptanceStep(context, ${quote(step.text)}, {`,
    `    keyword: ${quote(step.keyword)},`,
    `    text: ${quote(step.text)},`,
    `    sourcePath: ${quote(sourcePath)},`,
    `    line: ${step.line}`,
    "  });",
    "});",
    ""
  ];
}
function quote(value) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}'`;
}
function indentLines(lines, spaces) {
  const prefix = " ".repeat(spaces);
  return lines.map((line) => line === "" ? line : `${prefix}${line}`);
}

// src/shared/flagValue.ts
function flagValue(args2, name) {
  const inlineFlag = args2.find((arg) => arg.startsWith(`${name}=`));
  if (inlineFlag) {
    return inlineFlag.slice(name.length + 1);
  }
  const flagIndex = args2.indexOf(name);
  return flagIndex >= 0 ? args2[flagIndex + 1] : void 0;
}

// src/shared/parseTarget.ts
function parseTargetArg(args2, valueFlags) {
  const flags = valueFlags;
  for (let index = 0; index < args2.length; index += 1) {
    const arg = args2[index];
    if (!arg.startsWith("--")) {
      return arg;
    }
    const nextArg = args2[index + 1];
    if (flags.includes(arg) && nextArg !== void 0 && !nextArg.startsWith("--")) {
      index += 1;
    }
  }
  return void 0;
}

// src/shared/cliArgs.ts
function cleanCliArgs(args2) {
  return args2.filter((arg) => arg !== "--");
}

// src/acceptance/command.ts
async function runAcceptanceCli(rawArgs, options = {}) {
  const args2 = cleanCliArgs(rawArgs);
  const [command2, ...commandArgs] = args2;
  if (command2 !== "compile") {
    throw new Error("Usage: quality-tools acceptance compile --spec <glob> --steps <path> --out <path>");
  }
  await compileAcceptance(commandArgs, options.cwd ?? process.cwd());
}
async function compileAcceptance(args2, cwd) {
  const options = parseCompileOptions(args2);
  const specFiles = await findSpecFiles(cwd, options.specPatterns);
  if (specFiles.length === 0) {
    throw new Error(`No acceptance specs matched: ${options.specPatterns.join(", ")}`);
  }
  const documents = specFiles.map((specFile) => parseSpecFile(cwd, specFile));
  writeIrFiles(cwd, options.irDir, documents);
  writeDryReports(cwd, options.dryReportDir, documents);
  if (options.outDir) {
    writeSplitPlaywrightSpecs(cwd, options, documents);
    return;
  }
  if (!options.outPath) {
    throw new Error("Missing required --out <path> or --out-dir <path>");
  }
  const outPath = path.resolve(cwd, options.outPath);
  const stepsImportPath = createStepsImportPath(outPath, path.resolve(cwd, options.stepsPath));
  writeFile(outPath, generatePlaywrightAcceptanceSpec(documents, { stepsImportPath }));
}
function parseCompileOptions(args2) {
  const specPatterns = collectFlagValues(args2, "--spec");
  const stepsPath = requireFlagValue(args2, "--steps");
  const outPath = collectFlagValues(args2, "--out").at(0);
  const outDir = collectFlagValues(args2, "--out-dir").at(0);
  const irDir = collectFlagValues(args2, "--ir-dir").at(0);
  const dryReportDir = collectFlagValues(args2, "--dry-report-dir").at(0);
  if (specPatterns.length === 0) {
    throw new Error("Missing required --spec <glob>");
  }
  if (outPath && outDir) {
    throw new Error("Use either --out <path> or --out-dir <path>, not both");
  }
  return {
    specPatterns,
    stepsPath,
    outPath,
    outDir,
    irDir,
    dryReportDir
  };
}
function parseSpecFile(cwd, specFile) {
  const source = fs.readFileSync(specFile, "utf8");
  return parseAcceptanceMarkdown(source, toPosixPath(path.relative(cwd, specFile)));
}
function writeIrFiles(cwd, irDir, documents) {
  if (!irDir) {
    return;
  }
  const resolvedDir = path.resolve(cwd, irDir);
  documents.forEach((document) => {
    writeJsonFile(path.join(resolvedDir, `${sourcePathSlug(document.sourcePath)}.json`), toAcceptanceIr(document));
  });
}
function writeDryReports(cwd, dryReportDir, documents) {
  if (!dryReportDir) {
    return;
  }
  const resolvedDir = path.resolve(cwd, dryReportDir);
  documents.forEach((document) => {
    writeJsonFile(path.join(resolvedDir, `${sourcePathSlug(document.sourcePath)}.json`), analyzeAcceptanceIrDryness(document));
  });
}
function writeSplitPlaywrightSpecs(cwd, options, documents) {
  if (!options.outDir) {
    return;
  }
  const outDir = path.resolve(cwd, options.outDir);
  const stepsPath = path.resolve(cwd, options.stepsPath);
  documents.forEach((document) => {
    const outPath = path.join(outDir, `${sourcePathSlug(document.sourcePath)}.spec.ts`);
    const stepsImportPath = createStepsImportPath(outPath, stepsPath);
    writeFile(outPath, generatePlaywrightAcceptanceSpec([document], { stepsImportPath }));
  });
}
function writeJsonFile(filePath, data) {
  writeFile(filePath, `${JSON.stringify(data, null, 2)}
`);
}
function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}
async function findSpecFiles(cwd, patterns) {
  const files = await Promise.all(
    patterns.map((pattern) => glob(pattern, { absolute: true, cwd, nodir: true }))
  );
  return files.flat().sort((left, right) => left.localeCompare(right));
}
function createStepsImportPath(outPath, stepsPath) {
  const relativePath = toPosixPath(path.relative(path.dirname(outPath), stepsPath));
  const extension = path.extname(relativePath);
  const extensionlessPath = extension ? relativePath.slice(0, -extension.length) : relativePath;
  if (extensionlessPath.startsWith(".")) {
    return extensionlessPath;
  }
  return `./${extensionlessPath}`;
}
function collectFlagValues(args2, flag) {
  const values = [];
  args2.forEach((arg, index) => {
    if (arg === flag) {
      const value = args2[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${flag}`);
      }
      values.push(value);
    }
  });
  return values;
}
function requireFlagValue(args2, flag) {
  const value = collectFlagValues(args2, flag).at(0);
  if (!value) {
    throw new Error(`Missing required ${flag} <path>`);
  }
  return value;
}
function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}
function sourcePathSlug(sourcePath) {
  return sourcePath.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// src/shared/resolve/repoRoot.ts
import { resolve as resolve3 } from "node:path";

// src/shared/resolve/moduleDirectory.ts
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
function moduleDirectory(moduleUrl) {
  if (!moduleUrl) {
    return void 0;
  }
  if (moduleUrl.startsWith("file:")) {
    return dirname(fileURLToPath(moduleUrl));
  }
  if (moduleUrl.startsWith("/")) {
    return dirname(moduleUrl);
  }
  return void 0;
}

// src/shared/resolve/packageRoot.ts
import { existsSync } from "node:fs";
import { dirname as dirname2, join, resolve } from "node:path";
function packageRootFrom(repoRoot, start) {
  if (!start) {
    return void 0;
  }
  for (let currentDirectory = resolve(start), previousDirectory; currentDirectory !== previousDirectory; previousDirectory = currentDirectory, currentDirectory = dirname2(currentDirectory)) {
    if (repoRoot && currentDirectory === repoRoot) {
      return void 0;
    }
    if (existsSync(join(currentDirectory, "package.json"))) {
      return currentDirectory;
    }
  }
  return void 0;
}

// src/shared/resolve/workspaceRoot.ts
import { existsSync as existsSync2 } from "node:fs";
import { dirname as dirname3, join as join2, resolve as resolve2 } from "node:path";
var STRONG_ROOT_MARKERS = ["quality.config.json", "pnpm-workspace.yaml"];
var FALLBACK_ROOT_MARKERS = ["package.json", ".git"];
function workspaceRootFrom(start) {
  if (!start) {
    return void 0;
  }
  let fallbackRoot;
  for (let currentDirectory = resolve2(start), previousDirectory = ""; currentDirectory !== previousDirectory; previousDirectory = currentDirectory, currentDirectory = dirname3(currentDirectory)) {
    if (STRONG_ROOT_MARKERS.some((marker) => existsSync2(join2(currentDirectory, marker)))) {
      return currentDirectory;
    }
    if (!fallbackRoot && FALLBACK_ROOT_MARKERS.some((marker) => existsSync2(join2(currentDirectory, marker)))) {
      fallbackRoot = currentDirectory;
    }
  }
  return fallbackRoot;
}

// src/shared/resolve/repoRoot.ts
function envRepoRoot(env) {
  const configuredRoot = env.TEST_REPO_ROOT ?? env.QUALITY_TOOLS_ROOT ?? env.GITHUB_WORKSPACE;
  return configuredRoot ? resolve3(configuredRoot) : void 0;
}
function resolveRepoRoot(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const configuredRepoRoot = envRepoRoot(env);
  if (configuredRepoRoot) {
    return configuredRepoRoot;
  }
  const cwdWorkspaceRoot = workspaceRootFrom(cwd);
  if (cwdWorkspaceRoot) {
    return cwdWorkspaceRoot;
  }
  throw new Error(`Unable to resolve project root from cwd "${cwd}"`);
}
function resolvePackageRoot(options = {}) {
  const moduleUrl = options.moduleUrl ?? import.meta.url;
  const modulePath = moduleDirectory(moduleUrl);
  const discoveredPackageRoot = packageRootFrom(void 0, modulePath);
  if (discoveredPackageRoot) {
    return discoveredPackageRoot;
  }
  throw new Error(`Unable to resolve quality-tools package root from module URL "${moduleUrl}"`);
}
var REPO_ROOT = resolveRepoRoot();
var PACKAGE_ROOT = resolvePackageRoot();

// src/shared/util/pathUtils.ts
import { relative, sep } from "path";
function toPosix(value) {
  return value.replace(/\\/g, "/").split(sep).join("/");
}
function relativeTo(root, value) {
  return toPosix(relative(root, value));
}

// src/shared/util/packageTarget.ts
function findContainingPackage(absolutePath, workspacePackages) {
  return workspacePackages.filter((workspacePackage) => absolutePath === workspacePackage.root || absolutePath.startsWith(`${workspacePackage.root}/`)).sort((left, right) => right.root.length - left.root.length)[0];
}

// src/shared/resolve/path.ts
import { existsSync as existsSync4, statSync } from "fs";
import { isAbsolute, resolve as resolve4 } from "path";

// src/shared/util/workspacePackages.ts
import { existsSync as existsSync3, readFileSync } from "fs";
import { basename, dirname as dirname4, join as join3 } from "path";
import { globSync } from "glob";
function workspacePackageFromPackageJson(repoRoot, relativePackageJson) {
  const packageJsonPath = join3(repoRoot, relativePackageJson);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const relativeRoot = toPosix(dirname4(relativePackageJson));
  return {
    ...manifest.name ? { manifestName: manifest.name } : {},
    name: manifest.name?.split("/").pop() ?? basename(dirname4(packageJsonPath)),
    relativeRoot,
    root: join3(repoRoot, relativeRoot)
  };
}
function pnpmWorkspaceGlobs(repoRoot) {
  const workspacePath = join3(repoRoot, "pnpm-workspace.yaml");
  if (!existsSync3(workspacePath)) {
    return [];
  }
  const lines = readFileSync(workspacePath, "utf-8").split(/\r?\n/);
  const packageGlobs = [];
  let inPackagesBlock = false;
  for (const line of lines) {
    if (/^\s*packages\s*:/.test(line)) {
      inPackagesBlock = true;
      continue;
    }
    if (!inPackagesBlock) {
      continue;
    }
    if (/^\S/.test(line)) {
      break;
    }
    const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
    if (match) {
      packageGlobs.push(match[1]);
    }
  }
  return packageGlobs;
}
function packageJsonWorkspaceGlobs(repoRoot) {
  const packageJsonPath = join3(repoRoot, "package.json");
  if (!existsSync3(packageJsonPath)) {
    return [];
  }
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  if (Array.isArray(manifest.workspaces)) {
    return manifest.workspaces;
  }
  return manifest.workspaces?.packages ?? [];
}
function workspaceGlobs(repoRoot) {
  return pnpmWorkspaceGlobs(repoRoot).length > 0 ? pnpmWorkspaceGlobs(repoRoot) : packageJsonWorkspaceGlobs(repoRoot);
}
function packageJsonGlob(pattern) {
  const normalizedPattern = toPosix(pattern).replace(/\/$/, "");
  return normalizedPattern.endsWith("/package.json") ? normalizedPattern : `${normalizedPattern}/package.json`;
}
function discoverWorkspacePackageJsons(repoRoot) {
  const positiveGlobs = workspaceGlobs(repoRoot).filter((pattern) => !pattern.startsWith("!"));
  const negativeGlobs = workspaceGlobs(repoRoot).filter((pattern) => pattern.startsWith("!")).map((pattern) => packageJsonGlob(pattern.slice(1)));
  return [...new Set(
    positiveGlobs.flatMap((pattern) => globSync(packageJsonGlob(pattern), {
      cwd: repoRoot,
      dot: true,
      ignore: ["**/node_modules/**", ...negativeGlobs],
      nodir: true,
      posix: true
    }))
  )].sort();
}
function shouldIncludeRootPackage(repoRoot, packageJsons) {
  return existsSync3(join3(repoRoot, "package.json")) && (packageJsons.length === 0 || existsSync3(join3(repoRoot, "src")) || existsSync3(join3(repoRoot, "tests")));
}
function listWorkspacePackages(repoRoot) {
  const packages = [];
  const packageJsons = discoverWorkspacePackageJsons(repoRoot);
  if (shouldIncludeRootPackage(repoRoot, packageJsons)) {
    const packageJson = JSON.parse(readFileSync(join3(repoRoot, "package.json"), "utf-8"));
    packages.push({
      ...packageJson.name ? { manifestName: packageJson.name } : {},
      name: packageJson.name?.split("/").pop() ?? "root",
      relativeRoot: ".",
      root: repoRoot
    });
  }
  return [
    ...packages,
    ...packageJsons.map((packageJson) => workspacePackageFromPackageJson(repoRoot, packageJson))
  ].sort((left, right) => left.name.localeCompare(right.name));
}

// src/shared/resolve/path.ts
function packagePathCandidates(repoRoot, input) {
  const normalizedInput = input.replace(/\/+$/, "");
  return listWorkspacePackages(repoRoot).flatMap((workspacePackage) => {
    const aliases = [
      workspacePackage.name,
      ...workspacePackage.manifestName ? [workspacePackage.manifestName] : []
    ];
    return aliases.flatMap((alias) => {
      if (normalizedInput === alias) {
        return [workspacePackage.root];
      }
      if (normalizedInput.startsWith(`${alias}/`)) {
        return [resolve4(workspacePackage.root, normalizedInput.slice(alias.length + 1))];
      }
      return [];
    });
  });
}
function resolveExistingPath(repoRoot, input) {
  if (!input) {
    return repoRoot;
  }
  const candidates = [
    isAbsolute(input) ? input : resolve4(repoRoot, input),
    ...packagePathCandidates(repoRoot, input)
  ];
  const found = candidates.find((candidate) => existsSync4(candidate));
  if (!found) {
    throw new Error(`Target not found: ${input}`);
  }
  return found;
}
function pathKind(absolutePath) {
  return statSync(absolutePath).isDirectory() ? "directory" : "file";
}

// src/shared/resolve/target.ts
function resolveQualityTarget(repoRoot, input) {
  const workspacePackages = listWorkspacePackages(repoRoot);
  const normalizedInput = input?.replace(/\/+$/, "");
  const explicitPackage = normalizedInput ? workspacePackages.find((workspacePackage2) => {
    const aliases = [
      workspacePackage2.name,
      ...workspacePackage2.manifestName ? [workspacePackage2.manifestName] : []
    ];
    return aliases.includes(normalizedInput);
  }) : void 0;
  const absolutePath = resolveExistingPath(repoRoot, input);
  if (absolutePath === repoRoot) {
    if (explicitPackage) {
      return {
        absolutePath,
        kind: "package",
        relativePath: ".",
        packageName: explicitPackage.name,
        packageRelativePath: ".",
        packageRoot: explicitPackage.root
      };
    }
    return {
      absolutePath,
      kind: "repo",
      relativePath: "."
    };
  }
  const workspacePackage = findContainingPackage(absolutePath, workspacePackages);
  const relativePath = relativeTo(repoRoot, absolutePath);
  const kind = pathKind(absolutePath);
  if (!workspacePackage) {
    return {
      absolutePath,
      kind,
      relativePath
    };
  }
  if (absolutePath === workspacePackage.root) {
    return {
      absolutePath,
      kind: "package",
      relativePath,
      packageName: workspacePackage.name,
      packageRelativePath: ".",
      packageRoot: workspacePackage.root
    };
  }
  return {
    absolutePath,
    kind,
    relativePath,
    packageName: workspacePackage.name,
    packageRelativePath: relativeTo(workspacePackage.root, absolutePath),
    packageRoot: workspacePackage.root
  };
}

// src/boundaries/analyze.ts
import { existsSync as existsSync5 } from "fs";
import { basename as basename3, join as join8 } from "path";

// src/boundaries/graph/packageAnalysis.ts
import { basename as basename2 } from "path";

// src/organize/cohesion/imports/parse.ts
import { readFileSync as readFileSync2 } from "fs";
import * as ts2 from "typescript";

// src/organize/cohesion/imports/scriptKind.ts
import * as ts from "typescript";
function getScriptKind(fileName) {
  if (fileName.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (fileName.endsWith(".js")) {
    return ts.ScriptKind.JS;
  }
  if (fileName.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  return ts.ScriptKind.TS;
}

// src/organize/cohesion/imports/parse.ts
function extractImports(sourceFile) {
  const imports = [];
  function visit(node) {
    if (ts2.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (moduleSpecifier && ts2.isStringLiteral(moduleSpecifier)) {
        imports.push(moduleSpecifier.text);
      }
    }
    if (ts2.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (moduleSpecifier && ts2.isStringLiteral(moduleSpecifier)) {
        imports.push(moduleSpecifier.text);
      }
    }
    ts2.forEachChild(node, visit);
  }
  visit(sourceFile);
  return imports;
}
function parseFileImports(filePath, fileName) {
  try {
    const fileContent = readFileSync2(filePath, "utf-8");
    const scriptKind = getScriptKind(fileName);
    const sourceFile = ts2.createSourceFile(
      fileName,
      fileContent,
      ts2.ScriptTarget.Latest,
      void 0,
      scriptKind
    );
    return extractImports(sourceFile);
  } catch {
    return [];
  }
}

// src/boundaries/graph/imports.ts
import { dirname as dirname5, join as join4 } from "path";
function resolveImportTarget(fromFile, specifier, candidatePaths) {
  if (specifier[0] !== ".") {
    return void 0;
  }
  const basePath = join4(dirname5(fromFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    join4(basePath, "index.ts"),
    join4(basePath, "index.tsx"),
    join4(basePath, "index.js"),
    join4(basePath, "index.jsx")
  ];
  return candidates.find((candidate) => candidatePaths.has(candidate));
}

// src/config/quality.ts
import { readFileSync as readFileSync3 } from "fs";
import { isAbsolute as isAbsolute2, join as join6, matchesGlob, relative as relative2, resolve as resolve5 } from "path";

// src/config/patterns.ts
import { join as join5 } from "path";
function normalizePatterns(patterns) {
  return (patterns ?? []).map(toPosix);
}
function mergeToolPatterns(defaults, overrides) {
  return {
    exclude: [...normalizePatterns(defaults?.exclude), ...normalizePatterns(overrides?.exclude)],
    include: [...normalizePatterns(defaults?.include), ...normalizePatterns(overrides?.include)]
  };
}
function mergeBoundaryPatterns(defaults, overrides) {
  return {
    exclude: [...normalizePatterns(defaults?.exclude), ...normalizePatterns(overrides?.exclude)],
    include: [...normalizePatterns(defaults?.include), ...normalizePatterns(overrides?.include)],
    entrypoints: [
      ...normalizePatterns(defaults?.entrypoints),
      ...normalizePatterns(overrides?.entrypoints)
    ],
    layers: overrides?.layers ?? defaults?.layers ?? []
  };
}
function packageRootPattern(packageRelativeRoot2, pattern) {
  if (packageRelativeRoot2 === ".") {
    return toPosix(pattern);
  }
  return toPosix(join5(packageRelativeRoot2, pattern));
}

// src/config/quality.ts
var CONFIG_FILE = "quality.config.json";
var DEFAULT_REPORTS_DIR = "reports/quality-tools";
function loadQualityConfig(repoRoot) {
  const configPath = join6(repoRoot, CONFIG_FILE);
  try {
    return JSON.parse(readFileSync3(configPath, "utf-8"));
  } catch {
    return {};
  }
}
function resolveFromRepoRoot(repoRoot, value) {
  return isAbsolute2(value) ? value : resolve5(repoRoot, value);
}
function resolveReportsDir(repoRoot) {
  const config = loadQualityConfig(repoRoot);
  return resolveFromRepoRoot(repoRoot, config.reportsDir ?? DEFAULT_REPORTS_DIR);
}
function relativeReportsDir(repoRoot) {
  return toPosix(relative2(repoRoot, resolveReportsDir(repoRoot)));
}
function resolveReportPath(repoRoot, ...segments) {
  return join6(resolveReportsDir(repoRoot), ...segments);
}
function relativeReportPath(repoRoot, ...segments) {
  return toPosix(relative2(repoRoot, resolveReportPath(repoRoot, ...segments)));
}
function resolvePackageToolPatterns(repoRoot, packageName, toolName) {
  const config = loadQualityConfig(repoRoot);
  return mergeToolPatterns(config.defaults?.[toolName], config.packages?.[packageName]?.[toolName]);
}
function resolveDefaultToolPatterns(repoRoot, toolName) {
  const config = loadQualityConfig(repoRoot);
  return mergeToolPatterns(config.defaults?.[toolName], void 0);
}
function resolvePackageToolGlobs(repoRoot, packageName, toolName) {
  const patterns = resolvePackageToolPatterns(repoRoot, packageName, toolName);
  const workspacePackage = listWorkspacePackages(repoRoot).find((entry) => entry.name === packageName);
  const packageRelativeRoot2 = workspacePackage?.relativeRoot ?? packageName;
  return {
    exclude: patterns.exclude.map((pattern) => packageRootPattern(packageRelativeRoot2, pattern)),
    include: patterns.include.map((pattern) => packageRootPattern(packageRelativeRoot2, pattern))
  };
}
function resolvePackageCrapCoverage(repoRoot, packageName) {
  const config = loadQualityConfig(repoRoot);
  const coverage = packageName ? config.packages?.[packageName]?.crap?.coverage ?? config.defaults?.crap?.coverage : config.defaults?.crap?.coverage;
  if (!coverage) {
    return [];
  }
  return Array.isArray(coverage) ? coverage : [coverage];
}
function resolveMutationStrykerConfig(repoRoot, packageName) {
  const config = loadQualityConfig(repoRoot);
  const configuredPath = packageName ? config.packages?.[packageName]?.mutation?.strykerConfig ?? config.defaults?.mutation?.strykerConfig : config.defaults?.mutation?.strykerConfig;
  return configuredPath ? resolveFromRepoRoot(repoRoot, configuredPath) : void 0;
}
function resolvePackageBoundaryConfig(repoRoot, packageName) {
  const config = loadQualityConfig(repoRoot);
  return mergeBoundaryPatterns(config.defaults?.boundaries, config.packages?.[packageName]?.boundaries);
}
function pathIncludedByTool(repoRoot, packageName, toolName, packageRelativePath) {
  const patterns = resolvePackageToolPatterns(repoRoot, packageName, toolName);
  const normalizedPath = toPosix(packageRelativePath);
  const included = patterns.include.length === 0 || patterns.include.some((pattern) => matchesGlob(normalizedPath, pattern));
  const excluded = patterns.exclude.some((pattern) => matchesGlob(normalizedPath, pattern));
  return included && !excluded;
}
function pathIncludedByDefaultTool(repoRoot, toolName, repoRelativePath) {
  const patterns = resolveDefaultToolPatterns(repoRoot, toolName);
  const normalizedPath = toPosix(repoRelativePath);
  const included = patterns.include.length === 0 || patterns.include.some((pattern) => matchesGlob(normalizedPath, pattern));
  const excluded = patterns.exclude.some((pattern) => matchesGlob(normalizedPath, pattern));
  return included && !excluded;
}

// src/boundaries/graph/node.ts
import { matchesGlob as matchesGlob2 } from "path";
function layerForPath(packageRelativePath, layers) {
  return layers.find((layer) => layer.include.some((pattern) => matchesGlob2(packageRelativePath, pattern)));
}
function isEntrypoint(packageRelativePath, entrypoints) {
  return entrypoints.some((pattern) => matchesGlob2(packageRelativePath, pattern));
}
function createNode(absolutePath, packageName, packageRelativePath, relativePath, layers, entrypoints) {
  const layer = layerForPath(packageRelativePath, layers);
  return {
    absolutePath,
    entrypoint: isEntrypoint(packageRelativePath, entrypoints),
    incoming: 0,
    layer: layer?.name,
    outgoing: 0,
    packageName,
    packageRelativePath,
    relativePath
  };
}

// src/boundaries/graph/selection.ts
import { join as join7, matchesGlob as matchesGlob3 } from "path";

// src/organize/metric/walk/scan.ts
import { readdirSync } from "fs";
import { resolve as resolve6 } from "path";

// src/organize/metric/walk/filters.ts
function isHidden(name) {
  return name.startsWith(".");
}
function isExcludedDirectory(name) {
  if (isHidden(name)) {
    return true;
  }
  return name === "node_modules" || name === "coverage" || name === "reports" || name === "dist" || name === "dist-e2e";
}
function isTypeScriptOrJavaScriptFile(name) {
  return /\.(ts|tsx|js|jsx)$/.test(name);
}

// src/organize/metric/walk/sort.ts
function sortDirectoryNames(names) {
  return [...names].sort();
}
function sortDirectoryEntries(entries) {
  return [...entries].sort((left, right) => left.directoryPath.localeCompare(right.directoryPath));
}

// src/organize/metric/walk/scan.ts
function scanDirectory(directoryPath) {
  const items = readdirSync(directoryPath, { withFileTypes: true });
  const files = [];
  const subdirectories = [];
  for (const item of items) {
    if (item.isFile() && isTypeScriptOrJavaScriptFile(item.name)) {
      files.push(item.name);
    } else if (item.isDirectory() && !isExcludedDirectory(item.name)) {
      subdirectories.push(item.name);
    }
  }
  return {
    files: sortDirectoryNames(files),
    subdirectories: sortDirectoryNames(subdirectories)
  };
}
function walkDirectoriesRecursive(directoryPath, entries) {
  const entry = scanDirectory(directoryPath);
  entries.push({
    directoryPath,
    files: entry.files,
    subdirectories: entry.subdirectories
  });
  for (const subdirectory of entry.subdirectories) {
    walkDirectoriesRecursive(resolve6(directoryPath, subdirectory), entries);
  }
}

// src/organize/metric/directoryWalk.ts
function walkDirectories(rootPath) {
  const entries = [];
  walkDirectoriesRecursive(rootPath, entries);
  return sortDirectoryEntries(entries);
}

// src/boundaries/graph/selection.ts
function isBoundaryEntrypoint(repoRoot, packageName, packageRelativePath) {
  const { entrypoints } = resolvePackageBoundaryConfig(repoRoot, packageName);
  return entrypoints.some((pattern) => matchesGlob3(packageRelativePath, pattern));
}
function resolvePackageCandidates(repoRoot, workspacePackage) {
  const entries = walkDirectories(workspacePackage.root);
  const selected = [];
  for (const entry of entries) {
    for (const fileName of entry.files) {
      const absolutePath = join7(entry.directoryPath, fileName);
      const packageRelativePath = toPosix(absolutePath.slice(workspacePackage.root.length + 1));
      if (isBoundaryEntrypoint(repoRoot, workspacePackage.name, packageRelativePath) || pathIncludedByTool(
        repoRoot,
        workspacePackage.name,
        "boundaries",
        packageRelativePath
      )) {
        selected.push(absolutePath);
      }
    }
  }
  return selected;
}

// src/boundaries/graph/nodeIndex.ts
function createNodesByPath(repoRoot, workspacePackage) {
  const config = resolvePackageBoundaryConfig(repoRoot, workspacePackage.name);
  const selectedPaths = resolvePackageCandidates(repoRoot, workspacePackage);
  const nodesByPath = new Map(
    selectedPaths.map((absolutePath) => {
      const packageRelativePath = toPosix(absolutePath.slice(workspacePackage.root.length + 1));
      const relativePath = toPosix(absolutePath.slice(repoRoot.length + 1));
      const node = createNode(
        absolutePath,
        workspacePackage.name,
        packageRelativePath,
        relativePath,
        config.layers,
        config.entrypoints
      );
      node.allowedLayers = config.layers.find((layer) => layer.name === node.layer)?.allow ?? [];
      return [absolutePath, node];
    })
  );
  return {
    candidatePaths: new Set(selectedPaths),
    nodesByPath
  };
}

// src/boundaries/graph/deadFiles.ts
function deadEnds(files) {
  return files.filter((file) => file.incoming === 0 && file.outgoing === 0 && !file.entrypoint);
}
function deadSurfaces(files) {
  return files.filter((file) => file.incoming === 0 && file.outgoing > 0 && !file.entrypoint);
}

// src/boundaries/graph/scope.ts
function fileIsInsideScope(filePath, scope) {
  if (!scope) {
    return true;
  }
  return filePath === scope.relativePath || filePath.startsWith(`${scope.relativePath}/`);
}
function selectedViolations(violations, files) {
  const scopedPaths = new Set(files.map((file) => file.relativePath));
  return violations.filter((violation) => scopedPaths.has(violation.from));
}
function selectedFiles(files, scope) {
  return files.filter((file) => fileIsInsideScope(file.relativePath, scope));
}
function createScopedReport(workspacePackage, files, violations, scope) {
  return {
    deadEnds: deadEnds(files),
    deadSurfaces: deadSurfaces(files),
    files,
    layerViolations: selectedViolations(violations, files),
    target: scope?.relativePath ?? workspacePackage.relativeRoot ?? workspacePackage.name
  };
}

// src/boundaries/graph/packageAnalysis.ts
function* collectViolations(absolutePath, nodesByPath, candidatePaths) {
  const node = nodesByPath.get(absolutePath);
  const imports = parseFileImports(absolutePath, basename2(absolutePath));
  for (const specifier of imports) {
    const resolvedImport = resolveImportTarget(absolutePath, specifier, candidatePaths);
    if (!resolvedImport) {
      continue;
    }
    const importedNode = nodesByPath.get(resolvedImport);
    node.outgoing += 1;
    importedNode.incoming += 1;
    if (node.layer && importedNode.layer && node.layer !== importedNode.layer && !node.allowedLayers.includes(importedNode.layer)) {
      yield {
        from: node.relativePath,
        fromLayer: node.layer,
        reason: `${node.layer} cannot depend on ${importedNode.layer}`,
        to: importedNode.relativePath,
        toLayer: importedNode.layer
      };
    }
  }
}
function analyzePackage(repoRoot, workspacePackage, scope) {
  const { candidatePaths, nodesByPath } = createNodesByPath(repoRoot, workspacePackage);
  const violations = Array.from(candidatePaths).flatMap(
    (absolutePath) => Array.from(collectViolations(absolutePath, nodesByPath, candidatePaths))
  );
  return createScopedReport(
    workspacePackage,
    selectedFiles([...nodesByPath.values()], scope),
    violations,
    scope
  );
}

// src/boundaries/merge.ts
function mergeReports(target, reports) {
  const files = [];
  const deadEnds2 = [];
  const deadSurfaces2 = [];
  const layerViolations = [];
  for (const report of reports) {
    files.push(...report.files);
    deadEnds2.push(...report.deadEnds);
    deadSurfaces2.push(...report.deadSurfaces);
    layerViolations.push(...report.layerViolations);
  }
  return {
    deadEnds: deadEnds2,
    deadSurfaces: deadSurfaces2,
    files,
    layerViolations,
    target
  };
}

// src/boundaries/analyze.ts
function analyzePackageRoot(repoRoot, workspacePackage, scope) {
  return analyzePackage(repoRoot, workspacePackage, scope);
}
function analyzeBoundaries(repoRoot, target) {
  const workspacePackages = listWorkspacePackages(repoRoot);
  if (target.kind === "repo") {
    return mergeReports(
      "packages",
      workspacePackages.map((workspacePackage) => analyzePackageRoot(repoRoot, workspacePackage))
    );
  }
  if (target.packageName) {
    const workspacePackage = workspacePackages.find((entry) => entry.name === target.packageName || entry.manifestName === target.packageName);
    return analyzePackageRoot(repoRoot, {
      name: target.packageName,
      root: target.packageRoot ?? workspacePackage?.root ?? join8(repoRoot, target.packageName),
      relativeRoot: workspacePackage?.relativeRoot
    }, target);
  }
  if (existsSync5(target.absolutePath)) {
    const workspacePackage = {
      name: basename3(target.absolutePath),
      root: target.absolutePath
    };
    return analyzePackageRoot(repoRoot, workspacePackage, target);
  }
  return {
    deadEnds: [],
    deadSurfaces: [],
    files: [],
    layerViolations: [],
    target: target.relativePath
  };
}

// src/boundaries/report/format.ts
function formatLayerLabel(layer) {
  return layer ? ` [${layer}]` : "";
}
function summaryLines(report) {
  return [
    "",
    `Boundaries for ${report.target}`,
    "\u2501".repeat(72),
    `Files: ${report.files.length}`,
    `Layer violations: ${report.layerViolations.length}`,
    `Dead surfaces: ${report.deadSurfaces.length}`,
    `Dead ends: ${report.deadEnds.length}`,
    ""
  ];
}
function formatBoundaryFile(file) {
  return `- ${file.relativePath}${formatLayerLabel(file.layer)} (in: ${file.incoming}, out: ${file.outgoing})`;
}
function formatBoundaryViolation(violation) {
  return `- ${violation.from} [${violation.fromLayer ?? "unclassified"}] -> ${violation.to} [${violation.toLayer ?? "unclassified"}]: ${violation.reason}`;
}

// src/boundaries/report/print.ts
function logLines(lines) {
  for (const line of lines) {
    console.log(line);
  }
}
function reportBoundarySection(title, items, formatter) {
  if (items.length === 0) {
    return;
  }
  console.log(title);
  for (const item of items) {
    console.log(formatter(item));
  }
  console.log("");
}
function reportBoundaries(report, options = {}) {
  if (report.files.length === 0) {
    console.log("\nNo boundary-scope files found.\n");
    return;
  }
  logLines(summaryLines(report));
  reportBoundarySection("Layer violations:", report.layerViolations, formatBoundaryViolation);
  reportBoundarySection("Dead surfaces:", report.deadSurfaces, formatBoundaryFile);
  reportBoundarySection("Dead ends:", report.deadEnds, formatBoundaryFile);
  if (options.verbose) {
    console.log("All analyzed files:");
    for (const file of report.files) {
      console.log(formatBoundaryFile(file));
    }
  }
}

// src/boundaries/command.ts
var DEFAULT_DEPENDENCIES = {
  analyzeBoundaries,
  reportBoundaries,
  resolveQualityTarget,
  setExitCode: (code) => {
    process.exitCode = code;
  }
};
function runBoundariesCli(rawArgs, dependencies = DEFAULT_DEPENDENCIES) {
  const args2 = cleanCliArgs(rawArgs);
  const target = dependencies.resolveQualityTarget(
    REPO_ROOT,
    parseTargetArg(args2, [])
  );
  const report = dependencies.analyzeBoundaries(REPO_ROOT, target);
  const verbose = args2.includes("--verbose");
  const strict = args2.includes("--strict");
  const json = args2.includes("--json");
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    dependencies.reportBoundaries(report, { verbose });
  }
  const hasHardFailures = report.layerViolations.length > 0 || report.deadEnds.length > 0;
  const hasStrictFailures = strict && report.deadSurfaces.length > 0;
  if (hasHardFailures || hasStrictFailures) {
    dependencies.setExitCode(1);
  }
}

// src/crap/analysis/run.ts
import { existsSync as existsSync6 } from "fs";
import * as path3 from "path";

// src/crap/analysis/calculate.ts
function calculateCrap(complexity, coverage) {
  const uncovered = 1 - coverage / 100;
  return complexity ** 2 * uncovered ** 3 + complexity;
}

// src/crap/analysis/extractFunctions.ts
import * as ts6 from "typescript";

// src/crap/complexity/compute.ts
import * as ts3 from "typescript";
var BRANCHING_KINDS = /* @__PURE__ */ new Set([
  ts3.SyntaxKind.IfStatement,
  ts3.SyntaxKind.ForStatement,
  ts3.SyntaxKind.ForInStatement,
  ts3.SyntaxKind.ForOfStatement,
  ts3.SyntaxKind.WhileStatement,
  ts3.SyntaxKind.DoStatement,
  ts3.SyntaxKind.CaseClause,
  ts3.SyntaxKind.CatchClause,
  ts3.SyntaxKind.ConditionalExpression
]);
var SHORT_CIRCUIT_OPERATORS = /* @__PURE__ */ new Set([
  ts3.SyntaxKind.AmpersandAmpersandToken,
  ts3.SyntaxKind.BarBarToken,
  ts3.SyntaxKind.QuestionQuestionToken
]);
function complexityIncrement(node) {
  if (BRANCHING_KINDS.has(node.kind)) {
    return 1;
  }
  if (ts3.isBinaryExpression(node) && SHORT_CIRCUIT_OPERATORS.has(node.operatorToken.kind)) {
    return 1;
  }
  return 0;
}
function walkComplexity(node) {
  let total = complexityIncrement(node);
  ts3.forEachChild(node, (child) => {
    total += walkComplexity(child);
  });
  return total;
}
function computeComplexity(node) {
  let total = 0;
  ts3.forEachChild(node, (child) => {
    total += walkComplexity(child);
  });
  return total + 1;
}

// src/crap/complexity/getFunctionName.ts
import * as ts4 from "typescript";
function identifierText(name) {
  return ts4.isIdentifier(name) ? name.text : void 0;
}
function declarationName(node) {
  if (ts4.isFunctionDeclaration(node) || ts4.isMethodDeclaration(node)) {
    return node.name ? identifierText(node.name) : void 0;
  }
  return void 0;
}
function accessorName(node) {
  if (ts4.isGetAccessorDeclaration(node)) {
    const name = identifierText(node.name);
    return name ? `get ${name}` : void 0;
  }
  if (ts4.isSetAccessorDeclaration(node)) {
    const name = identifierText(node.name);
    return name ? `set ${name}` : void 0;
  }
  return void 0;
}
function constructorName(node) {
  return ts4.isConstructorDeclaration(node) ? "constructor" : void 0;
}
function isNamedParent(node) {
  return !!node && (ts4.isVariableDeclaration(node) || ts4.isPropertyAssignment(node) || ts4.isPropertyDeclaration(node));
}
function variableLikeFunctionName(node) {
  return isNamedParent(node.parent) ? identifierText(node.parent.name) : void 0;
}
function getFunctionName(node) {
  return declarationName(node) ?? accessorName(node) ?? constructorName(node) ?? (ts4.isArrowFunction(node) || ts4.isFunctionExpression(node) ? variableLikeFunctionName(node) : void 0) ?? "(anonymous)";
}

// src/crap/complexity/trackedFunctionNodes.ts
import * as ts5 from "typescript";
var TRACKED_FUNCTION_KINDS = /* @__PURE__ */ new Set([
  ts5.SyntaxKind.FunctionDeclaration,
  ts5.SyntaxKind.FunctionExpression,
  ts5.SyntaxKind.ArrowFunction,
  ts5.SyntaxKind.MethodDeclaration,
  ts5.SyntaxKind.GetAccessor,
  ts5.SyntaxKind.SetAccessor,
  ts5.SyntaxKind.Constructor
]);
function isTrackedFunctionNode(node) {
  return TRACKED_FUNCTION_KINDS.has(node.kind);
}

// src/crap/analysis/extractFunctions.ts
function extractFunctions(sourceFile) {
  const functions = [];
  function walk2(node) {
    if (isTrackedFunctionNode(node)) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      functions.push({
        complexity: computeComplexity(node),
        endLine: end.line + 1,
        file: sourceFile.fileName,
        line: start.line + 1,
        name: getFunctionName(node)
      });
    }
    ts6.forEachChild(node, walk2);
  }
  walk2(sourceFile);
  return functions;
}

// src/crap/analysis/fileSelection.ts
import { readFileSync as readFileSync4 } from "fs";
import * as path2 from "path";
import * as ts7 from "typescript";
function matchesFilterScope(relativePath, filterScope) {
  if (!filterScope) {
    return true;
  }
  if (relativePath === filterScope) {
    return true;
  }
  return relativePath.startsWith(`${filterScope}/`);
}
function shouldIncludeFile(filePath, filterScope, repoRoot) {
  const relativePath = toPosix(path2.relative(repoRoot, filePath));
  if (!matchesFilterScope(relativePath, filterScope)) {
    return false;
  }
  const workspacePackage = findContainingPackage(filePath, listWorkspacePackages(repoRoot));
  if (!workspacePackage) {
    return pathIncludedByDefaultTool(repoRoot, "crap", relativePath);
  }
  return pathIncludedByTool(
    repoRoot,
    workspacePackage.name,
    "crap",
    toPosix(path2.relative(workspacePackage.root, filePath))
  );
}
function createSourceFile3(filePath) {
  return ts7.createSourceFile(
    filePath,
    readFileSync4(filePath, "utf-8"),
    ts7.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts7.ScriptKind.TSX : ts7.ScriptKind.TS
  );
}

// src/crap/coverage/function.ts
function statementsInRange(fn, fileCoverage) {
  return Object.entries(fileCoverage.statementMap).filter(([, location]) => location.start.line >= fn.line && location.end.line <= fn.endLine).map(([id]) => fileCoverage.s[id] > 0);
}
function getFunctionCoverage(fn, fileCoverage) {
  const statementCoverage = statementsInRange(fn, fileCoverage);
  if (statementCoverage.length === 0) {
    return 0;
  }
  const covered = statementCoverage.filter(Boolean).length;
  return covered / statementCoverage.length * 100;
}

// src/crap/analysis/run.ts
function analyzeCoverageEntry(filePath, fileCoverage, repoRoot, threshold) {
  const sourceFile = createSourceFile3(filePath);
  return extractFunctions(sourceFile).map((fn) => {
    const coverage = getFunctionCoverage(fn, fileCoverage);
    const crap = calculateCrap(fn.complexity, coverage);
    return {
      complexity: fn.complexity,
      coverage: Math.round(coverage),
      crap: Math.round(crap * 100) / 100,
      file: toPosix(path3.relative(repoRoot, fn.file)),
      line: fn.line,
      name: fn.name
    };
  }).filter((result) => result.crap > threshold);
}
function analyzeCrap(coverageReports, repoRoot, filterScope, threshold = 8) {
  return coverageReports.flatMap((coverageReport) => Object.entries(coverageReport)).filter(([filePath]) => shouldIncludeFile(filePath, filterScope, repoRoot)).filter(([filePath]) => existsSync6(filePath)).flatMap(([filePath, fileCoverage]) => analyzeCoverageEntry(filePath, fileCoverage, repoRoot, threshold)).sort((left, right) => right.crap - left.crap);
}

// src/crap/coverage/factories.ts
import { isAbsolute as isAbsolute3, join as join9, relative as relative5, resolve as resolve7 } from "path";

// src/shared/util/reportKey.ts
function trimEdgeDashes(value) {
  return value.replace(/^-+/, "").replace(/-+$/, "");
}
function reportKeySegments(value) {
  return value.toLowerCase().split(/[^a-z0-9.-]+/).map(trimEdgeDashes).filter((segment) => segment !== "");
}
function sanitizeReportKey(value) {
  return reportKeySegments(value).join("-");
}

// src/crap/coverage/factories.ts
function workspacePackageName(repoRoot, packageName) {
  if (!packageName) {
    return void 0;
  }
  const workspacePackage = listWorkspacePackages(repoRoot).find((entry) => entry.name === packageName);
  return workspacePackage?.manifestName ?? packageName;
}
function targetPackageRoot(repoRoot, target) {
  return target.packageRoot ?? repoRoot;
}
function reportKeyForTarget(target) {
  if (target.kind === "repo") {
    return "repo";
  }
  return target.packageName ?? sanitizeReportKey(target.relativePath);
}
function templateValues(repoRoot, target) {
  const packageName = target.packageName ?? "";
  const packageRoot = targetPackageRoot(repoRoot, target);
  return {
    packageJsonName: workspacePackageName(repoRoot, target.packageName) ?? packageName,
    packageName,
    packageRoot,
    reportKey: reportKeyForTarget(target),
    reportsDir: relativeReportsDir(repoRoot),
    repoRoot,
    target: target.relativePath,
    targetPath: target.relativePath
  };
}
function applyTemplate(value, values) {
  return value.replace(/\{([a-zA-Z]+)\}/g, (match, rawKey) => {
    const key = rawKey;
    return values[key] ?? match;
  });
}
function resolvePathFromRepo(repoRoot, value) {
  return isAbsolute3(value) ? value : resolve7(repoRoot, value);
}
function configuredCoverageProfile(repoRoot, target, config) {
  const values = templateValues(repoRoot, target);
  const cwd = config.cwd ? resolvePathFromRepo(repoRoot, applyTemplate(config.cwd, values)) : repoRoot;
  const defaultProfile = defaultCoverageProfile(repoRoot, target);
  const coveragePath = config.coveragePath ? resolvePathFromRepo(repoRoot, applyTemplate(config.coveragePath, values)) : defaultProfile.coveragePath;
  return {
    args: (config.args ?? defaultProfile.args).map((arg) => applyTemplate(arg, values)),
    command: config.command ? applyTemplate(config.command, values) : defaultProfile.command,
    coveragePath,
    cwd,
    ...config.env ? {
      env: Object.fromEntries(
        Object.entries(config.env).map(([key, value]) => [key, applyTemplate(value, values)])
      )
    } : {}
  };
}
function defaultCoverageProfile(repoRoot, target) {
  const packageJsonName = workspacePackageName(repoRoot, target.packageName);
  const reportDirectory2 = resolveReportPath(repoRoot, "crap", reportKeyForTarget(target));
  if (target.packageName && packageJsonName) {
    return {
      args: [
        "--filter",
        packageJsonName,
        "exec",
        "vitest",
        "run",
        "--coverage",
        "--coverage.reportsDirectory",
        reportDirectory2
      ],
      command: "pnpm",
      coveragePath: join9(reportDirectory2, "coverage-final.json"),
      cwd: repoRoot
    };
  }
  return {
    args: ["exec", "vitest", "run", "--coverage", "--coverage.reportsDirectory", reportDirectory2],
    command: "pnpm",
    coveragePath: join9(reportDirectory2, "coverage-final.json"),
    cwd: repoRoot
  };
}
function coverageProfilesForTarget(repoRoot, target) {
  const configuredProfiles = resolvePackageCrapCoverage(repoRoot, target.packageName);
  if (configuredProfiles.length > 0) {
    return configuredProfiles.map((config) => configuredCoverageProfile(repoRoot, target, config));
  }
  return [defaultCoverageProfile(repoRoot, target)];
}

// src/crap/coverage/profiles.ts
function createCoverageProfiles(repoRoot, target) {
  return coverageProfilesForTarget(repoRoot, target);
}

// src/crap/coverage/read.ts
import { existsSync as existsSync7, readFileSync as readFileSync5 } from "fs";
function readCoverageReport(path4) {
  if (!existsSync7(path4)) {
    throw new Error(`Coverage data not found: ${path4}`);
  }
  return JSON.parse(readFileSync5(path4, "utf-8"));
}

// src/crap/report.ts
function reportCrap(results, threshold) {
  if (results.length === 0) {
    console.log(`
\u2705 All functions have CRAP score \u2264 ${threshold}.
`);
    return;
  }
  console.log(`
\u26A0\uFE0F  CRAP SCORE THRESHOLD EXCEEDED (max: ${threshold})`);
  console.log("\u2501".repeat(70));
  console.log("Functions with high complexity and low test coverage.\n");
  console.log(`${"CRAP".padStart(6)}  ${"Comp".padStart(4)}  ${"Cov%".padStart(4)}  Function`);
  console.log(`${"\u2500".repeat(6)}  ${"\u2500".repeat(4)}  ${"\u2500".repeat(4)}  ${"\u2500".repeat(50)}`);
  for (const result of results) {
    console.log(
      `${result.crap.toFixed(1).padStart(6)}  ${String(result.complexity).padStart(4)}  ${`${result.coverage}%`.padStart(4)}  ${result.name} (${result.file}:${result.line})`
    );
  }
  console.log(`
${"\u2501".repeat(70)}`);
  console.log(`${results.length} function(s) exceed CRAP threshold of ${threshold}.`);
  console.log("Refactor to reduce complexity or add tests to increase coverage.\n");
}

// src/shared/scope/source.ts
function resolveSourceScope(target) {
  if (target.kind === "repo") {
    return void 0;
  }
  return target.relativePath;
}
function assertSourceScope(target) {
  const scope = resolveSourceScope(target);
  if (!scope && target.kind !== "repo") {
    throw new Error(
      "This command expects the repo root, a package root, a directory, or a file target."
    );
  }
  return scope;
}

// src/shared/runCommand.ts
import * as childProcess from "child_process";
function runCommand(command2, args2, cwd, env) {
  childProcess.execFileSync(command2, args2, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: "inherit"
  });
}

// src/crap/command.ts
var DEFAULT_DEPENDENCIES2 = {
  analyzeCrap,
  createCoverageProfiles,
  readCoverageReport,
  reportCrap,
  resolveQualityTarget,
  runCommand
};
function parseThreshold(args2) {
  const rawThreshold = flagValue(args2, "--threshold");
  if (rawThreshold === void 0) {
    return 8;
  }
  const threshold = Number(rawThreshold);
  if (rawThreshold.trim() === "" || !Number.isFinite(threshold)) {
    throw new Error(`Invalid CRAP threshold: ${rawThreshold}`);
  }
  return threshold;
}
function runCrapCli(rawArgs, dependencies = DEFAULT_DEPENDENCIES2) {
  const args2 = cleanCliArgs(rawArgs);
  const target = dependencies.resolveQualityTarget(REPO_ROOT, parseTargetArg(args2, ["--threshold"]));
  const threshold = parseThreshold(args2);
  const filterScope = assertSourceScope(target);
  const profiles = dependencies.createCoverageProfiles(REPO_ROOT, target);
  profiles.forEach((profile) => {
    if (profile.env) {
      dependencies.runCommand(profile.command, profile.args, profile.cwd, profile.env);
      return;
    }
    dependencies.runCommand(profile.command, profile.args, profile.cwd);
  });
  const reports = profiles.map((profile) => dependencies.readCoverageReport(profile.coveragePath));
  const results = dependencies.analyzeCrap(reports, REPO_ROOT, filterScope, threshold);
  dependencies.reportCrap(results, threshold);
}

// src/cli/init.ts
import { existsSync as existsSync8, writeFileSync } from "node:fs";
import { join as join10 } from "node:path";
var CONFIG_FILE2 = "quality.config.json";
var DEFAULT_CONFIG = {
  reportsDir: "reports/quality-tools",
  defaults: {
    mutation: {
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.d.ts"]
    },
    crap: {
      coverage: {
        command: "pnpm",
        args: [
          "exec",
          "vitest",
          "run",
          "--coverage",
          "--coverage.reportsDirectory",
          "{repoRoot}/{reportsDir}/crap/{reportKey}"
        ],
        coveragePath: "{repoRoot}/{reportsDir}/crap/{reportKey}/coverage-final.json"
      },
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"]
    },
    scrap: {
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
      exclude: []
    },
    boundaries: {
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.d.ts", "**/*.test.ts", "**/*.test.tsx"]
    },
    organize: {
      lowInfoNames: {
        banned: ["utils", "helpers", "misc", "common", "shared", "_shared", "lib", "index"],
        discouraged: ["types", "constants", "config", "base", "core"]
      }
    }
  },
  packages: {}
};
function runInitCli(_args = [], cwd = process.cwd()) {
  const configPath = join10(cwd, CONFIG_FILE2);
  if (existsSync8(configPath)) {
    console.log(`${CONFIG_FILE2} already exists`);
    return;
  }
  writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}
`);
  console.log(`Created ${CONFIG_FILE2}`);
}

// src/mutation/runner/run.ts
import { spawn } from "child_process";

// src/mutation/reporting/reportArtifacts.ts
import { cpSync, existsSync as existsSync9, mkdirSync } from "fs";
import { join as join11 } from "path";
function rootReportDirectory(repoRoot = REPO_ROOT) {
  return relativeReportPath(repoRoot, "mutation");
}
function reportDirectory(reportKey, repoRoot = REPO_ROOT) {
  return `${rootReportDirectory(repoRoot)}/${reportKey}`;
}
function incrementalReportPath(reportKey, repoRoot = REPO_ROOT) {
  return `${reportDirectory(reportKey, repoRoot)}/stryker-incremental-${reportKey}.json`;
}
function copySharedMutationReports(reportKey, repoRoot = process.cwd()) {
  const targetDirectory = join11(repoRoot, reportDirectory(reportKey, repoRoot));
  mkdirSync(targetDirectory, { recursive: true });
  const sharedJson = join11(repoRoot, rootReportDirectory(repoRoot), "mutation.json");
  const sharedHtml = join11(repoRoot, rootReportDirectory(repoRoot), "mutation.html");
  const targetIncremental = join11(repoRoot, incrementalReportPath(reportKey, repoRoot));
  if (existsSync9(sharedJson)) {
    cpSync(sharedJson, `${targetDirectory}/mutation.json`);
  }
  if (existsSync9(sharedHtml)) {
    cpSync(sharedHtml, `${targetDirectory}/mutation.html`);
  }
  if (!existsSync9(targetIncremental) && existsSync9(sharedJson)) {
    cpSync(sharedJson, targetIncremental);
  }
  return join11(targetDirectory, "mutation.json");
}

// src/mutation/reporting/check.ts
import { readFileSync as readFileSync6 } from "fs";
function findMutationSiteViolations(reportPath, threshold = 50) {
  const report = JSON.parse(readFileSync6(reportPath, "utf-8"));
  return Object.entries(report.files ?? {}).map(([file, entry]) => ({ count: (entry.mutants ?? []).length, file })).filter((entry) => entry.count > threshold).sort((left, right) => right.count - left.count);
}
function reportMutationSiteViolations(reportPath, threshold = 50) {
  const violations = findMutationSiteViolations(reportPath, threshold);
  if (violations.length === 0) {
    console.log(`
\u2705 All files are within the mutation site threshold (${threshold}).
`);
    return;
  }
  console.log(`
\u26A0\uFE0F  MUTATION SITE THRESHOLD EXCEEDED (max: ${threshold})`);
  console.log("\u2501".repeat(60));
  console.log("The following files have too many mutation sites, indicating");
  console.log("high complexity. Consider splitting them into smaller modules.\n");
  for (const violation of violations) {
    console.log(`  ${violation.count} mutation sites  \u2192  ${violation.file}`);
  }
  console.log(`
${"\u2501".repeat(60)}`);
  console.log(`${violations.length} file(s) exceed the threshold of ${threshold} mutation sites.
`);
}

// src/mutation/analysis/mutateGlobs.ts
function buildScopeIncludes(scope, kind) {
  if (kind === "file") {
    return [scope];
  }
  return [`${scope}/**/*.ts`, `${scope}/**/*.tsx`];
}
function buildMutateGlobs(target, patterns) {
  if (target.kind === "repo") {
    return [
      ...patterns.include.length > 0 ? patterns.include : ["**/*.ts", "**/*.tsx"],
      ...patterns.exclude.map((pattern) => `!${pattern}`)
    ];
  }
  if (target.kind === "package") {
    return [
      ...patterns.include.length > 0 ? patterns.include : [`${target.relativePath}/**/*.ts`, `${target.relativePath}/**/*.tsx`],
      ...patterns.exclude.map((pattern) => `!${pattern}`)
    ];
  }
  return [
    ...buildScopeIncludes(target.relativePath, target.kind),
    ...patterns.exclude.map((pattern) => `!${pattern}`)
  ];
}

// src/mutation/analysis/profile.ts
import { existsSync as existsSync10 } from "fs";
import { join as join12 } from "path";
function defaultHostStrykerConfig(repoRoot) {
  return [
    "stryker.config.cjs",
    "stryker.config.mjs",
    "stryker.config.js",
    "stryker.conf.js"
  ].map((fileName) => join12(repoRoot, fileName)).find((configPath) => existsSync10(configPath));
}
function resolveMutationProfile(target) {
  const packageConfig = resolveMutationStrykerConfig(REPO_ROOT, target.packageName) ?? defaultHostStrykerConfig(REPO_ROOT) ?? `${PACKAGE_ROOT}/stryker.config.cjs`;
  return {
    configPath: packageConfig,
    ...target.packageName ? { packageName: target.packageName } : {}
  };
}

// src/mutation/runner/args.ts
function configuredExcludeGlobs(patterns) {
  return patterns.exclude.map((pattern) => `!${pattern}`);
}
function buildMutationArgs(target, options = {}) {
  const profile = resolveMutationProfile(target);
  const reportKey = target.kind === "repo" ? "repo" : target.kind === "package" && profile.packageName ? profile.packageName : sanitizeReportKey(target.relativePath);
  const args2 = ["run", profile.configPath, "--incrementalFile", incrementalReportPath(reportKey)];
  if (options.force) {
    args2.push("--force");
  }
  const configPatterns = profile.packageName ? resolvePackageToolGlobs(REPO_ROOT, profile.packageName, "mutation") : resolveDefaultToolPatterns(REPO_ROOT, "mutation");
  const mutateGlobs = options.mutateGlobs ? [...options.mutateGlobs, ...configuredExcludeGlobs(configPatterns)] : buildMutateGlobs(target, configPatterns);
  args2.push("-m", mutateGlobs.join(","));
  return { args: args2, reportKey };
}

// src/mutation/runner/strykerBinary.ts
import { createRequire } from "node:module";
import { dirname as dirname6, join as join13 } from "node:path";
var require2 = createRequire(import.meta.url);
function strykerBinPath() {
  return join13(dirname6(require2.resolve("@stryker-mutator/core/package.json")), "bin/stryker.js");
}

// src/mutation/runner/environment.ts
function buildMutationEnv(options = {}) {
  return {
    ...process.env,
    QUALITY_TOOLS_REPORTS_DIR: relativeReportsDir(REPO_ROOT),
    ...options.testIncludes ? { QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify(options.testIncludes) } : {}
  };
}

// src/mutation/runner/progress.ts
var ANSI_PATTERN = new RegExp(
  `${String.fromCharCode(27)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g"
);
var PROGRESS_PATTERN = /Mutation testing\s+(?:\[(?<bracketStatus>[^\]]*)\]\s*)?(?<percent>\d+%)\s+\((?<timing>elapsed:[^)]+)\)\s+(?<count>\d+\/\d+)\s+(?:Mutants?|tested)(?:\s+\((?<tailStatus>\d+\s+survived,\s*\d+\s+timed out)\))?/i;
var STATUS_TAIL_PATTERN = /(?:^|\s)tested\s+\((?<status>\d+\s+survived,\s*\d+\s+timed out)\)\s*$/i;
function cleanProgressText(text) {
  return text.replace(ANSI_PATTERN, "").trim();
}
function normalizeStatus(status) {
  const trimmed = status?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : void 0;
}
var MutationProgressTracker = class {
  latest;
  formatLatest() {
    if (!this.latest) {
      return void 0;
    }
    return [
      "Mutation testing",
      `[${this.latest.status ?? ""}]`,
      this.latest.percent,
      `(${this.latest.timing})`,
      this.latest.count,
      "Mutants"
    ].join(" ");
  }
  observe(text) {
    const cleanText = cleanProgressText(text);
    if (cleanText.length === 0) {
      return false;
    }
    const progressMatch = PROGRESS_PATTERN.exec(cleanText);
    if (progressMatch?.groups) {
      this.latest = {
        count: progressMatch.groups.count,
        percent: progressMatch.groups.percent,
        timing: progressMatch.groups.timing,
        status: normalizeStatus(progressMatch.groups.tailStatus) ?? normalizeStatus(progressMatch.groups.bracketStatus) ?? this.latest?.status
      };
      return true;
    }
    const statusMatch = STATUS_TAIL_PATTERN.exec(cleanText);
    if (statusMatch?.groups && this.latest) {
      this.latest = {
        ...this.latest,
        status: normalizeStatus(statusMatch.groups.status) ?? this.latest.status
      };
      return true;
    }
    return false;
  }
};
function createMutationProgressOutputForwarder(tracker, writeOutput) {
  let pending = "";
  const handleSegment = (segment, delimiter) => {
    if (tracker.observe(segment)) {
      return;
    }
    writeOutput(`${segment}${delimiter}`);
  };
  const flushPendingProgress = () => {
    if (tracker.observe(pending)) {
      pending = "";
      return true;
    }
    return false;
  };
  return {
    flush() {
      if (pending.length === 0 || flushPendingProgress()) {
        return;
      }
      writeOutput(pending);
      pending = "";
    },
    write(text) {
      pending += text;
      let delimiterIndex = pending.search(/[\r\n]/);
      while (delimiterIndex >= 0) {
        const segment = pending.slice(0, delimiterIndex);
        const delimiter = pending[delimiterIndex] === "\n" ? "\n" : "";
        pending = pending.slice(delimiterIndex + 1);
        handleSegment(segment, delimiter);
        delimiterIndex = pending.search(/[\r\n]/);
      }
      flushPendingProgress();
    }
  };
}

// src/mutation/runner/run.ts
var MUTATION_PROGRESS_INTERVAL_MS = 6e4;
function formatElapsedDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1e3));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
function runStryker(args2, env, target) {
  return new Promise((resolve8, reject) => {
    const startedAt = Date.now();
    const progressTracker = new MutationProgressTracker();
    const stdoutForwarder = createMutationProgressOutputForwarder(
      progressTracker,
      (text) => process.stdout.write(text)
    );
    const stderrForwarder = createMutationProgressOutputForwarder(
      progressTracker,
      (text) => process.stderr.write(text)
    );
    const child = spawn(process.execPath, [strykerBinPath(), ...args2], {
      cwd: REPO_ROOT,
      env,
      stdio: ["inherit", "pipe", "pipe"]
    });
    child.stdout?.on("data", (chunk) => {
      stdoutForwarder.write(String(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      stderrForwarder.write(String(chunk));
    });
    const progressTimer = setInterval(() => {
      console.error(
        progressTracker.formatLatest() ?? `[mutation] Still running ${target.relativePath} after ${formatElapsedDuration(Date.now() - startedAt)}...`
      );
    }, MUTATION_PROGRESS_INTERVAL_MS);
    const clearProgressTimer = () => {
      clearInterval(progressTimer);
      stdoutForwarder.flush();
      stderrForwarder.flush();
    };
    child.once("error", (error) => {
      clearProgressTimer();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearProgressTimer();
      if (code === 0) {
        resolve8();
        return;
      }
      reject(new Error(`Stryker exited with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`));
    });
  });
}
async function runMutation(target, options = {}) {
  const { args: args2, reportKey } = buildMutationArgs(target, options);
  await runStryker(args2, buildMutationEnv(options), target);
  const reportPath = copySharedMutationReports(reportKey, REPO_ROOT);
  reportMutationSiteViolations(reportPath);
}

// src/mutation/runner/command.ts
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "--mutate",
  "--mutate-glob",
  "--mutate-globs-json",
  "--test-include",
  "--test-includes-json"
]);
function createDefaultMutationCliDependencies() {
  return {
    resolveQualityTarget,
    runMutation
  };
}
function resolveCliTargets(input, mutateInput, dependencies) {
  if (mutateInput) {
    return [dependencies.resolveQualityTarget(REPO_ROOT, mutateInput)];
  }
  if (input) {
    return [dependencies.resolveQualityTarget(REPO_ROOT, input)];
  }
  throw new Error(
    "Mutation requires an explicit package, directory, file, or repo target. Example: `quality-tools mutate .` or `quality-tools mutate packages/foo/src/bar.ts`."
  );
}
function parseBareMutationTargetArg(args2) {
  for (let index = 0; index < args2.length; index += 1) {
    const arg = args2[index];
    if (VALUE_FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    if (!arg.startsWith("--")) {
      return arg;
    }
  }
  return void 0;
}
function collectFlagValues2(args2, name) {
  const values = [];
  for (let index = 0; index < args2.length; index += 1) {
    const arg = args2[index];
    if (arg === name && args2[index + 1]) {
      values.push(args2[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1));
    }
  }
  return values;
}
function parseJsonStringArray(value, flagName) {
  if (!value) {
    return [];
  }
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error(`${flagName} must be a JSON array of strings.`);
  }
  return parsed;
}
function mutationRunOptions(args2) {
  const mutateGlobs = [
    ...collectFlagValues2(args2, "--mutate-glob"),
    ...parseJsonStringArray(flagValue(args2, "--mutate-globs-json"), "--mutate-globs-json")
  ];
  const testIncludes = [
    ...collectFlagValues2(args2, "--test-include"),
    ...parseJsonStringArray(flagValue(args2, "--test-includes-json"), "--test-includes-json")
  ];
  return {
    force: args2.includes("--force"),
    ...mutateGlobs.length > 0 ? { mutateGlobs } : {},
    ...testIncludes.length > 0 ? { testIncludes } : {}
  };
}
async function runMutationCli(rawArgs, dependencies = createDefaultMutationCliDependencies()) {
  const args2 = cleanCliArgs(rawArgs);
  const targets = resolveCliTargets(
    parseBareMutationTargetArg(args2),
    flagValue(args2, "--mutate"),
    dependencies
  );
  const options = mutationRunOptions(args2);
  for (const target of targets) {
    await dependencies.runMutation(target, options);
  }
}

// src/organize/command.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join16 } from "path";

// src/organize/analyze/run.ts
import { relative as relative7 } from "path";

// src/organize/rules.ts
import { readFileSync as readFileSync7 } from "fs";
import { join as join14 } from "path";
var DEFAULT_CONFIG2 = {
  lowInfoNames: {
    banned: ["utils", "helpers", "misc", "common", "shared", "_shared", "lib", "index"],
    discouraged: ["types", "constants", "config", "base", "core"]
  },
  fileFanOut: { warning: 8, split: 10 },
  folderFanOut: { warning: 10, split: 13 },
  depth: { warning: 4, deep: 5 },
  redundancyThreshold: 0.3,
  cohesionClusterMinSize: 3
};
var CONFIG_FILE3 = "quality.config.json";
function mergeConfig(defaults, overrides) {
  return {
    lowInfoNames: overrides.lowInfoNames ?? defaults.lowInfoNames,
    fileFanOut: overrides.fileFanOut ?? defaults.fileFanOut,
    folderFanOut: overrides.folderFanOut ?? defaults.folderFanOut,
    depth: overrides.depth ?? defaults.depth,
    redundancyThreshold: overrides.redundancyThreshold ?? defaults.redundancyThreshold,
    cohesionClusterMinSize: overrides.cohesionClusterMinSize ?? defaults.cohesionClusterMinSize
  };
}
function loadOrganizeConfig(repoRoot, packageName) {
  const configPath = join14(repoRoot, CONFIG_FILE3);
  try {
    const rawConfig = JSON.parse(readFileSync7(configPath, "utf-8"));
    const defaultConfig = rawConfig.defaults?.organize;
    const packageConfig = packageName ? rawConfig.packages?.[packageName]?.organize : void 0;
    const mergedDefaults = defaultConfig ? mergeConfig(DEFAULT_CONFIG2, defaultConfig) : DEFAULT_CONFIG2;
    return packageConfig ? mergeConfig(mergedDefaults, packageConfig) : mergedDefaults;
  } catch {
    return DEFAULT_CONFIG2;
  }
}

// src/organize/metric/fileFanOut.ts
function fileFanOutVerdict(fileCount, warningThreshold, splitThreshold) {
  if (fileCount >= splitThreshold) {
    return "SPLIT";
  }
  if (fileCount >= warningThreshold) {
    return "WARNING";
  }
  return "STABLE";
}

// src/organize/metric/folderFanOut.ts
function folderFanOutVerdict(folderCount, warningThreshold, splitThreshold) {
  if (folderCount >= splitThreshold) {
    return "SPLIT";
  }
  if (folderCount >= warningThreshold) {
    return "WARNING";
  }
  return "STABLE";
}

// src/organize/metric/directoryDepth.ts
import { relative as relative6, sep as sep2 } from "path";
function directoryDepth(directoryPath, targetRoot) {
  const relativePath = relative6(targetRoot, directoryPath);
  if (relativePath === "") {
    return 0;
  }
  return relativePath.split(sep2).length;
}
function depthVerdict(depth, warningThreshold, deepThreshold) {
  if (depth >= deepThreshold) {
    return "DEEP";
  }
  if (depth >= warningThreshold) {
    return "WARNING";
  }
  return "STABLE";
}

// src/organize/cohesion/imports/graph.ts
import { join as join15 } from "path";

// src/organize/cohesion/imports/extensions.ts
function removeExtension(fileName) {
  const compoundExtensions = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];
  for (const ext of compoundExtensions) {
    if (fileName.endsWith(ext)) {
      return fileName.slice(0, -ext.length);
    }
  }
  const singleExtensions = [".ts", ".tsx", ".js", ".jsx"];
  for (const ext of singleExtensions) {
    if (fileName.endsWith(ext)) {
      return fileName.slice(0, -ext.length);
    }
  }
  return fileName;
}

// src/organize/cohesion/imports/resolve.ts
function resolveImportToFile(importSpecifier, availableFiles) {
  if (!importSpecifier.startsWith("./")) {
    return void 0;
  }
  let relativePath = importSpecifier.slice(2);
  const compoundExtensions = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];
  for (const ext of compoundExtensions) {
    if (relativePath.endsWith(ext)) {
      relativePath = relativePath.slice(0, -ext.length);
      break;
    }
  }
  const singleExtensions = [".ts", ".tsx", ".js", ".jsx"];
  for (const ext of singleExtensions) {
    if (relativePath.endsWith(ext)) {
      relativePath = relativePath.slice(0, -ext.length);
      break;
    }
  }
  return availableFiles.get(relativePath);
}

// src/organize/cohesion/imports/graph.ts
function addImportsToAdjacency(fileName, imports, adjacency, availableFiles) {
  for (const importSpecifier of imports) {
    const resolvedFileName = resolveImportToFile(importSpecifier, availableFiles);
    if (resolvedFileName) {
      adjacency.get(fileName).add(resolvedFileName);
    }
  }
}
function buildImportGraph(directoryPath, fileNames) {
  const adjacency = /* @__PURE__ */ new Map();
  for (const fileName of fileNames) {
    adjacency.set(fileName, /* @__PURE__ */ new Set());
  }
  const availableFiles = /* @__PURE__ */ new Map();
  for (const fileName of fileNames) {
    const baseName = removeExtension(fileName);
    availableFiles.set(baseName, fileName);
  }
  for (const fileName of fileNames) {
    const filePath = join15(directoryPath, fileName);
    const imports = parseFileImports(filePath, fileName);
    addImportsToAdjacency(fileName, imports, adjacency, availableFiles);
  }
  return adjacency;
}

// src/organize/naming/stripExtension.ts
function stripExtension(name) {
  const compoundExtensions = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];
  for (const ext of compoundExtensions) {
    if (name.endsWith(ext)) {
      return name.slice(0, -ext.length);
    }
  }
  const singleExtensions = [".ts", ".tsx", ".js", ".jsx"];
  for (const ext of singleExtensions) {
    if (name.endsWith(ext)) {
      return name.slice(0, -ext.length);
    }
  }
  return name;
}

// src/organize/naming/characters.ts
var UPPERCASE_A = "A".charCodeAt(0);
var UPPERCASE_Z = "Z".charCodeAt(0);
var LOWERCASE_A = "a".charCodeAt(0);
var LOWERCASE_Z = "z".charCodeAt(0);
var DIGIT_ZERO = "0".charCodeAt(0);
var DIGIT_NINE = "9".charCodeAt(0);
function isUppercaseLetter(character) {
  const code = character.charCodeAt(0);
  return code >= UPPERCASE_A && code <= UPPERCASE_Z;
}
function isLowercaseLetter(character) {
  const code = character.charCodeAt(0);
  return code >= LOWERCASE_A && code <= LOWERCASE_Z;
}
function isLetter(character) {
  return isUppercaseLetter(character) || isLowercaseLetter(character);
}
function isDigit(character) {
  const code = character.charCodeAt(0);
  return code >= DIGIT_ZERO && code <= DIGIT_NINE;
}
function isTokenCharacter(character) {
  return isLetter(character) || isDigit(character);
}

// src/organize/naming/boundaries.ts
function isLowerToUpperBoundary(previous, current) {
  return isLowercaseLetter(previous) && isUppercaseLetter(current);
}
function isLetterToDigitBoundary(previous, current) {
  return isLetter(previous) && isDigit(current);
}
function isDigitToLetterBoundary(previous, current) {
  return isDigit(previous) && isLetter(current);
}
function isAcronymBoundary(previous, current, next) {
  if (next === void 0) {
    return false;
  }
  return isUppercaseLetter(previous) && isUppercaseLetter(current) && isLowercaseLetter(next);
}
function shouldStartNewToken(previous, current, next) {
  return isLowerToUpperBoundary(previous, current) || isLetterToDigitBoundary(previous, current) || isDigitToLetterBoundary(previous, current) || isAcronymBoundary(previous, current, next);
}

// src/organize/naming/tokenize.ts
function tokenize2(name) {
  const withoutExtension = stripExtension(name);
  const characters = Array.from(withoutExtension);
  const tokens = [];
  let currentToken = "";
  characters.forEach((character, index) => {
    if (!isTokenCharacter(character)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken.toLowerCase());
        currentToken = "";
      }
      return;
    }
    const previous = currentToken[currentToken.length - 1] ?? "";
    if (shouldStartNewToken(previous, character, characters[index + 1])) {
      tokens.push(currentToken.toLowerCase());
      currentToken = character;
    } else {
      currentToken += character;
    }
  });
  if (currentToken.length > 0) {
    tokens.push(currentToken.toLowerCase());
  }
  return tokens;
}

// src/organize/cohesion/cluster/prefix.ts
function buildPrefixGroups(fileNames) {
  const groups = /* @__PURE__ */ new Map();
  for (const fileName of fileNames) {
    const tokens = tokenize2(fileName);
    if (tokens.length > 0) {
      const prefix = tokens[0];
      if (!groups.has(prefix)) {
        groups.set(prefix, /* @__PURE__ */ new Set());
      }
      groups.get(prefix).add(fileName);
    }
  }
  return groups;
}
function countFirstTokens(fileNames) {
  const tokenCounts = /* @__PURE__ */ new Map();
  for (const fileName of fileNames) {
    const tokens = tokenize2(fileName);
    if (tokens.length > 0) {
      const token = tokens[0];
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }
  return tokenCounts;
}
function findMostCommonToken(tokenCounts) {
  let mostCommonToken = "";
  let maxCount = 0;
  for (const [token, count] of tokenCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonToken = token;
    }
  }
  return mostCommonToken;
}
function derivePrefix(fileNames) {
  if (fileNames.length === 0) {
    return "";
  }
  const tokenCounts = countFirstTokens(fileNames);
  const mostCommonToken = findMostCommonToken(tokenCounts);
  if (mostCommonToken.length > 0) {
    return mostCommonToken;
  }
  return fileNames[0];
}

// src/organize/cohesion/cluster/components.ts
function findImportComponents(fileNames, importGraph) {
  const visited = /* @__PURE__ */ new Set();
  const components = [];
  for (const fileName of fileNames) {
    if (!visited.has(fileName)) {
      const component = /* @__PURE__ */ new Set();
      bfsComponent(fileName, importGraph, visited, component);
      components.push(component);
    }
  }
  return components;
}
function bfsComponent(startFile, importGraph, visited, component) {
  const queue = [startFile];
  const queued = new Set(visited);
  queued.add(startFile);
  visited.add(startFile);
  component.add(startFile);
  while (queue.length > 0) {
    const current = queue.shift();
    const importedFiles = importGraph.get(current) ?? /* @__PURE__ */ new Set();
    for (const imported of importedFiles) {
      if (queued.has(imported)) {
        continue;
      }
      queued.add(imported);
      visited.add(imported);
      component.add(imported);
      queue.push(imported);
    }
    for (const [file, imports] of importGraph) {
      if (!imports.has(current) || queued.has(file)) {
        continue;
      }
      queued.add(file);
      visited.add(file);
      component.add(file);
      queue.push(file);
    }
  }
}

// src/organize/cohesion/cluster/overlap.ts
function isComponentCovered(component, assignedFiles) {
  for (const member of component) {
    if (assignedFiles.has(member)) {
      return true;
    }
  }
  return false;
}
function addComponentToAssigned(component, assignedFiles) {
  for (const member of component) {
    assignedFiles.add(member);
  }
}
function findOverlappingComponent(members, components) {
  for (const component of components) {
    for (const member of members) {
      if (component.has(member)) {
        return component;
      }
    }
  }
  return void 0;
}
function hasSignificantOverlap(set1, set2) {
  const smallerSize = Math.min(set1.size, set2.size);
  const threshold = Math.ceil(smallerSize * 50 / 100);
  let overlapCount = 0;
  for (const item of set1) {
    if (set1.has(item) && set2.has(item)) {
      overlapCount++;
    }
  }
  return overlapCount >= threshold;
}

// src/organize/cohesion/cluster/find.ts
function createPrefixCluster(prefix, members, validImportComponents) {
  const memberArray = Array.from(members).sort();
  const overlapComponent = findOverlappingComponent(members, validImportComponents);
  const confidence = overlapComponent && hasSignificantOverlap(members, overlapComponent) ? "prefix+imports" : "prefix-only";
  return {
    prefix,
    members: memberArray,
    memberCount: memberArray.length,
    suggestedFolder: prefix.toLowerCase(),
    confidence
  };
}
function createImportCluster(component) {
  const memberArray = Array.from(component).sort();
  const prefix = derivePrefix(memberArray);
  return {
    prefix,
    members: memberArray,
    memberCount: memberArray.length,
    suggestedFolder: prefix.toLowerCase(),
    confidence: "imports-only"
  };
}
function findCohesionClusters(fileNames, importGraph, minClusterSize) {
  const clusters = [];
  const prefixGroups = buildPrefixGroups(fileNames);
  const validPrefixGroups = /* @__PURE__ */ new Map();
  for (const [prefix, members] of prefixGroups) {
    if (members.size >= minClusterSize) {
      validPrefixGroups.set(prefix, members);
    }
  }
  const importComponents = findImportComponents(fileNames, importGraph);
  const validImportComponents = importComponents.filter((component) => component.size >= minClusterSize);
  const assignedFiles = /* @__PURE__ */ new Set();
  for (const [prefix, members] of validPrefixGroups) {
    const cluster = createPrefixCluster(prefix, members, validImportComponents);
    clusters.push(cluster);
    addComponentToAssigned(members, assignedFiles);
  }
  for (const component of validImportComponents) {
    if (!isComponentCovered(component, assignedFiles)) {
      const cluster = createImportCluster(component);
      clusters.push(cluster);
      addComponentToAssigned(component, assignedFiles);
    }
  }
  clusters.sort((clusterA, clusterB) => {
    if (clusterA.memberCount !== clusterB.memberCount) {
      return clusterB.memberCount - clusterA.memberCount;
    }
    return clusterA.prefix.localeCompare(clusterB.prefix);
  });
  return clusters;
}

// src/organize/metric/naming/redundancy.ts
import { basename as basename5 } from "path";

// src/organize/metric/naming/conventional.ts
import { basename as basename4 } from "path";

// src/organize/metric/naming/nameStrip.ts
function stripExtension2(fileName) {
  let baseName = fileName;
  baseName = baseName.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "");
  if (baseName === fileName) {
    const lastDot = baseName.lastIndexOf(".");
    if (lastDot > 0) {
      baseName = baseName.slice(0, lastDot);
    }
  }
  return baseName;
}

// src/organize/metric/naming/conventional.ts
function isConventionalEntryFile(filePath, ancestorFolders) {
  const fileStem = stripExtension2(basename4(filePath));
  const lowerStem = fileStem.toLowerCase();
  const lowerAncestors = ancestorFolders.map((folder) => folder.toLowerCase());
  if (lowerStem === "index") {
    return true;
  }
  if (lowerStem === "app") {
    return lowerAncestors.includes("app");
  }
  if (lowerStem === "export") {
    return lowerAncestors.includes("export");
  }
  if (!lowerStem.startsWith("use")) {
    return false;
  }
  const hookName = fileStem.slice(3);
  const hookTokens = tokenize2(hookName);
  return hookTokens.some((hookToken) => ancestorFolders.some((folder) => {
    const folderTokens = tokenize2(folder);
    return folderTokens.includes(hookToken);
  }));
}

// src/organize/metric/naming/redundancy.ts
function pathRedundancy(filePath, ancestorFolders) {
  if (isConventionalEntryFile(filePath, ancestorFolders)) {
    return 0;
  }
  const fileName = basename5(filePath);
  const fileTokens = tokenize2(fileName);
  if (fileTokens.length === 0) {
    return 0;
  }
  const ancestorTokens = /* @__PURE__ */ new Set();
  for (const folder of ancestorFolders) {
    const folderTokens = tokenize2(folder);
    for (const token of folderTokens) {
      ancestorTokens.add(token);
    }
  }
  const sharedCount = fileTokens.filter((token) => ancestorTokens.has(token)).length;
  return sharedCount / fileTokens.length;
}

// src/organize/analyze/ancestors.ts
function extractAncestorFolders(directoryPath) {
  if (directoryPath === ".") {
    return [];
  }
  return directoryPath.split(/[/\\]/).filter((seg) => seg.length > 0);
}
function computeAverageRedundancy(fileNames, ancestorFolders) {
  const redundancyScores = fileNames.map((fileName) => pathRedundancy(fileName, ancestorFolders));
  if (redundancyScores.length === 0) {
    return 0;
  }
  const sum = redundancyScores.reduce((total, score) => total + score, 0);
  return sum / redundancyScores.length;
}

// src/organize/analyze/issues.ts
import { readFileSync as readFileSync8 } from "fs";

// src/organize/metric/naming/details.ts
var LOW_INFO_NAME_DETAILS = {
  utils: "Catch-all dumping ground; violates single responsibility",
  helpers: "Vague semantics; becomes unmaintainable",
  misc: "Literally means 'uncategorized'",
  common: "Attracts unrelated shared code",
  shared: "Breaks architectural layers; grows uncontrollably",
  _shared: "Variant of shared with same problems",
  lib: "Too generic; doesn't describe contents",
  index: "Indistinguishable in IDE tabs; breaks Go to Definition",
  types: "Can become a dump for unrelated type definitions",
  constants: "Can become a dump for unrelated values",
  config: "Vague without domain context",
  base: "Abstract without inheritance context",
  core: "Too broad; doesn't narrow scope"
};

// src/organize/metric/naming/lowInfo.ts
function checkLowInfoName(fileName, config, isPackageEntryPoint) {
  const baseName = stripExtension2(fileName);
  const lowerBaseName = baseName.toLowerCase();
  if (lowerBaseName === "index" && isPackageEntryPoint) {
    return void 0;
  }
  const bannedIndex = config.banned.findIndex((name) => name.toLowerCase() === lowerBaseName);
  if (bannedIndex >= 0) {
    const bannedName = config.banned[bannedIndex];
    const detail = LOW_INFO_NAME_DETAILS[bannedName] ?? "Low-information filename";
    return {
      detail,
      fileName,
      kind: "low-info-banned"
    };
  }
  const discouragedIndex = config.discouraged.findIndex((name) => name.toLowerCase() === lowerBaseName);
  if (discouragedIndex >= 0) {
    const discouragedName = config.discouraged[discouragedIndex];
    const detail = LOW_INFO_NAME_DETAILS[discouragedName] ?? "Low-information filename";
    return {
      detail,
      fileName,
      kind: "low-info-discouraged"
    };
  }
  return void 0;
}

// src/organize/metric/barrel/detection.ts
import * as ts9 from "typescript";

// src/organize/metric/barrel/reExport.ts
import * as ts8 from "typescript";
var SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx"]);
function getFileExtension(fileName) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(lastDot) : "";
}
function isReExportStatement(statement) {
  if (!ts8.isExportDeclaration(statement)) {
    return false;
  }
  if (statement.moduleSpecifier) {
    return true;
  }
  const exportClause = statement.exportClause;
  if (exportClause === void 0) {
    return false;
  }
  if (!ts8.isNamedExports(exportClause)) {
    return false;
  }
  return exportClause.elements.length > 0;
}

// src/organize/metric/barrel/detection.ts
function scriptKindForExtension(ext) {
  if (ext === ".tsx") {
    return ts9.ScriptKind.TSX;
  }
  if (ext === ".jsx") {
    return ts9.ScriptKind.JSX;
  }
  if (ext === ".js") {
    return ts9.ScriptKind.JS;
  }
  return ts9.ScriptKind.TS;
}
function checkBarrelFile(fileName, fileContent) {
  const ext = getFileExtension(fileName);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return void 0;
  }
  const sourceFile = ts9.createSourceFile(
    fileName,
    fileContent,
    ts9.ScriptTarget.Latest,
    void 0,
    scriptKindForExtension(ext)
  );
  let totalStatements = 0;
  let reExportCount = 0;
  for (const statement of sourceFile.statements) {
    if (!ts9.isModuleDeclaration(statement) && !ts9.isNamespaceExport(statement)) {
      totalStatements++;
    }
    if (isReExportStatement(statement)) {
      reExportCount++;
    }
  }
  const reExportRatio = reExportCount / totalStatements;
  if (reExportRatio >= 0.8) {
    const detail = `80% of statements are re-exports (${reExportCount} of ${totalStatements})`;
    return {
      detail,
      fileName,
      kind: "barrel"
    };
  }
  return void 0;
}

// src/organize/analyze/issues.ts
function collectFileIssues(fileNames, directoryPath, ancestorFolders, lowInfoNames, redundancyThreshold, isPackageEntryDirectory = true) {
  const issues = [];
  for (const fileName of fileNames) {
    const score = pathRedundancy(fileName, ancestorFolders);
    if (score >= redundancyThreshold) {
      issues.push({
        fileName,
        kind: "redundancy",
        detail: `filename repeats path context (${(score * 100).toFixed(0)}% token overlap)`,
        redundancyScore: score
      });
    }
    const lowInfoIssue = checkLowInfoName(fileName, lowInfoNames, isPackageEntryDirectory);
    if (lowInfoIssue) {
      issues.push(lowInfoIssue);
    }
    try {
      const filePath = `${directoryPath}/${fileName}`;
      const fileContent = readFileSync8(filePath, "utf-8");
      const barrelIssue = checkBarrelFile(fileName, fileContent);
      if (barrelIssue) {
        issues.push(barrelIssue);
      }
    } catch {
    }
  }
  return issues;
}

// src/organize/analyze/run.ts
function analyze(target) {
  const config = loadOrganizeConfig(REPO_ROOT, target.packageName);
  const entries = walkDirectories(target.absolutePath);
  const metrics = [];
  for (const entry of entries) {
    const directoryPath = entry.directoryPath === target.absolutePath ? "." : relative7(target.absolutePath, entry.directoryPath);
    const fileFanOut = entry.files.length;
    const fileFanOutVerd = fileFanOutVerdict(fileFanOut, config.fileFanOut.warning, config.fileFanOut.split);
    const folderFanOut = entry.subdirectories.length;
    const folderFanOutVerd = folderFanOutVerdict(folderFanOut, config.folderFanOut.warning, config.folderFanOut.split);
    const depth = directoryDepth(entry.directoryPath, target.absolutePath);
    const depthVerd = depthVerdict(depth, config.depth.warning, config.depth.deep);
    const ancestorFolders = extractAncestorFolders(directoryPath);
    const averageRedundancy = computeAverageRedundancy(entry.files, ancestorFolders);
    const fileIssues = collectFileIssues(
      entry.files,
      entry.directoryPath,
      ancestorFolders,
      config.lowInfoNames,
      config.redundancyThreshold,
      entry.directoryPath === target.absolutePath
    );
    const importGraph = buildImportGraph(entry.directoryPath, entry.files);
    const clusters = findCohesionClusters(entry.files, importGraph, config.cohesionClusterMinSize);
    metrics.push({
      averageRedundancy: Math.round(averageRedundancy * 100) / 100,
      clusters,
      depth,
      depthVerdict: depthVerd,
      directoryPath,
      fileIssues,
      fileFanOut,
      fileFanOutVerdict: fileFanOutVerd,
      folderFanOut,
      folderFanOutVerdict: folderFanOutVerd
    });
  }
  return metrics;
}

// src/organize/compare/baseline.ts
import { readFileSync as readFileSync9 } from "fs";

// src/organize/compare/verdict.ts
function verdictFromDeltas(fileFanOutDelta, folderFanOutDelta, clusterCountDelta, issueCountDelta, redundancyDelta) {
  const deltas = [fileFanOutDelta, folderFanOutDelta, clusterCountDelta, issueCountDelta, redundancyDelta];
  let direction = 0;
  for (const delta of deltas) {
    const nextDirection = Math.sign(delta);
    if (nextDirection === 0) {
      continue;
    }
    if (direction === 0) {
      direction = nextDirection;
      continue;
    }
    if (direction !== nextDirection) {
      return "mixed";
    }
  }
  if (direction < 0) {
    return "improved";
  }
  if (direction > 0) {
    return "worse";
  }
  return "unchanged";
}

// src/organize/compare/baseline.ts
function roundedDelta(current, previous) {
  return Math.round((current - previous) * 100) / 100;
}
function baselineMetricsByPath(baseline2) {
  return new Map(baseline2.map((metric) => [metric.directoryPath, metric]));
}
function compareBaseline(current, baselinePath) {
  const baselineData = JSON.parse(readFileSync9(baselinePath, "utf-8"));
  const previousByPath = baselineMetricsByPath(baselineData);
  const comparisons = /* @__PURE__ */ new Map();
  for (const metric of current) {
    const previous = previousByPath.get(metric.directoryPath);
    if (!previous) {
      continue;
    }
    const fileFanOutDelta = metric.fileFanOut - previous.fileFanOut;
    const folderFanOutDelta = metric.folderFanOut - previous.folderFanOut;
    const clusterCountDelta = metric.clusters.length - previous.clusters.length;
    const issueCountDelta = metric.fileIssues.length - previous.fileIssues.length;
    const redundancyDelta = roundedDelta(metric.averageRedundancy, previous.averageRedundancy);
    const comparison = {
      fileFanOutDelta,
      folderFanOutDelta,
      clusterCountDelta,
      issueCountDelta,
      redundancyDelta,
      verdict: verdictFromDeltas(fileFanOutDelta, folderFanOutDelta, clusterCountDelta, issueCountDelta, redundancyDelta)
    };
    comparisons.set(metric.directoryPath, comparison);
  }
  return comparisons;
}

// src/organize/report/clusters.ts
function clusterLines(clusters, directoryPath) {
  const lines = [];
  const indent = "  Clusters:  ";
  const indentAlignment = " ".repeat(indent.length);
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const confidence = cluster.confidence;
    const memberCount = cluster.memberCount;
    const base = directoryPath.endsWith("/") ? directoryPath : `${directoryPath}/`;
    const suggestedPath = `${base}${cluster.prefix}/`;
    const clusterLine = `${cluster.prefix} (${memberCount} files, ${confidence}) \u2192 suggest ${suggestedPath}`;
    if (i === 0) {
      lines.push(`${indent}${clusterLine}`);
    } else {
      lines.push(`${indentAlignment}${clusterLine}`);
    }
  }
  return lines;
}

// src/organize/report/issueFormatters.ts
function formatRedundancyIssues(issues) {
  if (issues.length === 0) {
    return void 0;
  }
  const itemsList = issues.map((issue2) => `${issue2.fileName} (${issue2.redundancyScore?.toFixed(2)})`).join(", ");
  return `  Redundant: ${itemsList}`;
}
function formatLowInfoIssues(issues) {
  if (issues.length === 0) {
    return void 0;
  }
  const itemsList = issues.map((issue2) => {
    const prefix = issue2.kind === "low-info-banned" ? "banned" : "discouraged";
    return `${issue2.fileName} (${prefix}: ${issue2.detail})`;
  }).join(", ");
  return `  Low-info:  ${itemsList}`;
}
function formatBarrelIssues(issues) {
  if (issues.length === 0) {
    return void 0;
  }
  const itemsList = issues.map((issue2) => `${issue2.fileName} (${issue2.detail})`).join(", ");
  return `  Barrels:   ${itemsList}`;
}

// src/organize/report/fileIssues.ts
function fileIssueLines(issues) {
  const redundancyIssues = issues.filter((i) => i.kind === "redundancy");
  const lowInfoIssues = issues.filter((i) => i.kind === "low-info-banned" || i.kind === "low-info-discouraged");
  const barrelIssues = issues.filter((i) => i.kind === "barrel");
  const lines = [];
  const redundancyLine = formatRedundancyIssues(redundancyIssues);
  if (redundancyLine) {
    lines.push(redundancyLine);
  }
  const lowInfoLine = formatLowInfoIssues(lowInfoIssues);
  if (lowInfoLine) {
    lines.push(lowInfoLine);
  }
  const barrelLine = formatBarrelIssues(barrelIssues);
  if (barrelLine) {
    lines.push(barrelLine);
  }
  return lines;
}

// src/organize/report/summary.ts
function worstVerdict(metric) {
  const depthVerdict2 = metric.depthVerdict === "DEEP" ? "SPLIT" : metric.depthVerdict;
  const verdicts = [depthVerdict2, metric.fileFanOutVerdict, metric.folderFanOutVerdict];
  if (verdicts.includes("SPLIT")) {
    return "SPLIT";
  }
  if (verdicts.includes("WARNING")) {
    return "WARNING";
  }
  return "STABLE";
}
function countIssuesByKind(metric, kindPrefix) {
  return metric.fileIssues.filter((issue2) => issue2.kind.startsWith(kindPrefix)).length;
}
function summaryLines2(metric) {
  const verdict = worstVerdict(metric);
  const redundantCount = countIssuesByKind(metric, "redundancy");
  const lowInfoCount = countIssuesByKind(metric, "low-info");
  const barrelCount = countIssuesByKind(metric, "barrel");
  const redundancy = metric.averageRedundancy.toFixed(2);
  const line = `${metric.directoryPath}  [${verdict}]  files: ${metric.fileFanOut}  folders: ${metric.folderFanOut}  depth: ${metric.depth}  redundancy: ${redundancy}  clusters: ${metric.clusters.length}  redundant: ${redundantCount}  low-info: ${lowInfoCount}  barrels: ${barrelCount}`;
  return [line];
}

// src/organize/report/format.ts
function logLines2(lines) {
  for (const line of lines) {
    console.log(line);
  }
}
function shouldShowDirectory(metric, verbose) {
  if (verbose) {
    return true;
  }
  if (metric.fileIssues.length > 0) {
    return true;
  }
  const allVerdictStable = metric.fileFanOutVerdict === "STABLE" && metric.folderFanOutVerdict === "STABLE" && metric.depthVerdict === "STABLE";
  return !allVerdictStable;
}
function reportOrganize(metrics, options = {}) {
  const metricsToShow = metrics.filter((metric) => shouldShowDirectory(metric, options.verbose ?? false));
  if (metricsToShow.length === 0) {
    console.log("No directories found for organize analysis.");
    return;
  }
  for (const metric of metricsToShow) {
    logLines2(summaryLines2(metric));
    logLines2(clusterLines(metric.clusters, metric.directoryPath));
    logLines2(fileIssueLines(metric.fileIssues));
    console.log("");
  }
}

// src/organize/command.ts
var DEFAULT_DEPENDENCIES3 = {
  analyze,
  compareBaseline,
  mkdirSync: mkdirSync2,
  reportOrganize,
  resolveQualityTarget,
  writeFileSync: writeFileSync2
};
function baselineReportTarget(targetRelativePath) {
  if (targetRelativePath === ".") {
    return "repo";
  }
  return targetRelativePath;
}
function baselinePathFor(targetRelativePath) {
  const reportKey = sanitizeReportKey(baselineReportTarget(targetRelativePath));
  return resolveReportPath(REPO_ROOT, "organize", `${reportKey}.json`);
}
function stripComparisonsForBaseline(metrics) {
  return metrics.map(({ comparison: _comparison, ...rest }) => rest);
}
function runOrganizeCli(rawArgs, dependencies = DEFAULT_DEPENDENCIES3) {
  const args2 = cleanCliArgs(rawArgs);
  const target = dependencies.resolveQualityTarget(REPO_ROOT, parseTargetArg(args2, ["--compare"]));
  const verbose = args2.includes("--verbose");
  const writeBaseline = args2.includes("--write-baseline");
  const comparePath = flagValue(args2, "--compare");
  let metrics = dependencies.analyze(target);
  if (comparePath) {
    const comparisons = dependencies.compareBaseline(metrics, comparePath);
    const metricsWithComparisons = metrics.map((metric) => ({
      ...metric,
      comparison: comparisons.get(metric.directoryPath)
    }));
    metrics = metricsWithComparisons;
  }
  if (writeBaseline) {
    const baselinePath = baselinePathFor(target.relativePath);
    dependencies.mkdirSync(join16(baselinePath, ".."), { recursive: true });
    const baseMetrics = stripComparisonsForBaseline(metrics);
    dependencies.writeFileSync(baselinePath, JSON.stringify(baseMetrics, null, 2));
  }
  if (args2.includes("--json")) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }
  dependencies.reportOrganize(metrics, { verbose });
}

// src/reachability/analyze.ts
function analyzeReachability(repoRoot, target) {
  const report = analyzeBoundaries(repoRoot, target);
  return {
    deadEnds: report.deadEnds,
    deadSurfaces: report.deadSurfaces,
    files: report.files,
    target: report.target
  };
}

// src/reachability/report.ts
function logLines3(lines) {
  for (const line of lines) {
    console.log(line);
  }
}
function summaryLines3(report) {
  return [
    "",
    `Reachability for ${report.target}`,
    "\u2501".repeat(72),
    `Files: ${report.files.length}`,
    `Dead surfaces: ${report.deadSurfaces.length}`,
    `Dead ends: ${report.deadEnds.length}`,
    ""
  ];
}
function formatFile(file) {
  const layerLabel = file.layer ? ` [${file.layer}]` : "";
  return `- ${file.relativePath}${layerLabel} (in: ${file.incoming}, out: ${file.outgoing})`;
}
function reportReachability(report, options = {}) {
  if (report.files.length === 0) {
    console.log("\nNo reachability-scope files found.\n");
    return;
  }
  logLines3(summaryLines3(report));
  if (report.deadSurfaces.length > 0) {
    console.log("Dead surfaces:");
    for (const file of report.deadSurfaces) {
      console.log(formatFile(file));
    }
    console.log("");
  }
  if (report.deadEnds.length > 0) {
    console.log("Dead ends:");
    for (const file of report.deadEnds) {
      console.log(formatFile(file));
    }
    console.log("");
  }
  if (options.verbose) {
    console.log("All analyzed files:");
    for (const file of report.files) {
      console.log(formatFile(file));
    }
  }
}

// src/reachability/command.ts
var DEFAULT_DEPENDENCIES4 = {
  analyzeReachability,
  reportReachability,
  resolveQualityTarget,
  setExitCode: (code) => {
    process.exitCode = code;
  }
};
function runReachabilityCli(rawArgs, dependencies = DEFAULT_DEPENDENCIES4) {
  const args2 = cleanCliArgs(rawArgs);
  const target = dependencies.resolveQualityTarget(
    REPO_ROOT,
    parseTargetArg(args2, [])
  );
  const report = dependencies.analyzeReachability(REPO_ROOT, target);
  const verbose = args2.includes("--verbose");
  const strict = args2.includes("--strict");
  const json = args2.includes("--json");
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    dependencies.reportReachability(report, { verbose });
  }
  const hasHardFailures = report.deadEnds.length > 0;
  const hasStrictFailures = strict && report.deadSurfaces.length > 0;
  if (hasHardFailures || hasStrictFailures) {
    dependencies.setExitCode(1);
  }
}

// src/scrap/analysis/pipeline/run.ts
import * as fs2 from "fs";
import * as ts25 from "typescript";

// src/scrap/test/discovery/files.ts
import { readFileSync as readFileSync10 } from "fs";

// src/scrap/test/discovery/globs.ts
import { globSync as globSync2 } from "glob";
function discoverPackageTestFiles(packageName, repoRoot) {
  const patterns = resolvePackageToolGlobs(repoRoot, packageName, "scrap");
  return [...new Set(patterns.include.flatMap((pattern) => globSync2(pattern, {
    absolute: true,
    cwd: repoRoot,
    ignore: patterns.exclude
  })))].sort();
}

// src/scrap/test/discovery/packages.ts
function packageNamesForTarget(target, repoRoot) {
  if (target.kind === "repo") {
    return listWorkspacePackages(repoRoot).map((workspacePackage) => workspacePackage.name);
  }
  return target.packageName ? [target.packageName] : [];
}

// src/scrap/test/discovery/sourceScope.ts
function packageRelativeRoot(target) {
  if (!target.packageRelativePath) {
    return void 0;
  }
  if (target.packageRelativePath === ".") {
    return target.relativePath;
  }
  if (target.relativePath === target.packageRelativePath) {
    return ".";
  }
  const suffix = `/${target.packageRelativePath}`;
  return target.relativePath.endsWith(suffix) ? target.relativePath.slice(0, -suffix.length) : void 0;
}
function packageTestRoot(target) {
  const relativeRoot = packageRelativeRoot(target);
  if (!relativeRoot) {
    return void 0;
  }
  return relativeRoot === "." ? "tests" : `${relativeRoot}/tests`;
}
function sourceTestScope(target) {
  if (!target.packageRoot || !target.packageRelativePath) {
    return void 0;
  }
  const testRoot = packageTestRoot(target);
  if (!testRoot) {
    return void 0;
  }
  if (target.packageRelativePath === "src") {
    return testRoot;
  }
  if (!target.packageRelativePath.startsWith("src/")) {
    return void 0;
  }
  return `${testRoot}/${target.packageRelativePath.slice("src/".length)}`;
}

// src/scrap/test/discovery/path.ts
function isTestPath(packageRelativePath) {
  if (!packageRelativePath) {
    return false;
  }
  return packageRelativePath === "tests" || packageRelativePath.startsWith("tests/");
}

// src/scrap/test/discovery/explicitTarget.ts
function hasExplicitTestFileTarget(target) {
  if (target.kind !== "file") {
    return false;
  }
  if (!target.packageName || !target.packageRelativePath) {
    return false;
  }
  return isTestPath(target.packageRelativePath);
}

// src/scrap/test/discovery/targetScope.ts
function isInsideTarget(target, repoRoot, absolutePath) {
  const relativePath = relativeTo(repoRoot, absolutePath);
  const mappedTestScope = sourceTestScope(target);
  if (mappedTestScope) {
    return relativePath === mappedTestScope || relativePath.startsWith(`${mappedTestScope}/`);
  }
  if (target.kind === "repo") {
    return true;
  }
  if (target.kind === "package") {
    if (target.relativePath === ".") {
      return relativePath !== "" && relativePath !== "." && relativePath !== ".." && !relativePath.startsWith("../");
    }
    return relativePath.startsWith(`${target.relativePath}/`);
  }
  return relativePath === target.relativePath || relativePath.startsWith(`${target.relativePath}/`);
}

// src/scrap/test/discovery/files.ts
function isBaselineMetricWithPath(metric) {
  return typeof metric.filePath === "string";
}
function discoverTestFiles(target) {
  if (hasExplicitTestFileTarget(target)) {
    return pathIncludedByTool(REPO_ROOT, target.packageName, "scrap", target.packageRelativePath) ? [target.absolutePath] : [];
  }
  return packageNamesForTarget(target, REPO_ROOT).flatMap((packageName) => discoverPackageTestFiles(packageName, REPO_ROOT)).filter((filePath) => isInsideTarget(target, REPO_ROOT, filePath));
}
function readBaselineMetrics(baselinePath) {
  return JSON.parse(readFileSync10(baselinePath, "utf-8"));
}
function baselineMetricsByPath2(baseline2) {
  return new Map(
    baseline2.filter(isBaselineMetricWithPath).map((metric) => [metric.filePath, metric])
  );
}

// src/scrap/analysis/pipeline/actionability.ts
function hasValidationIssues(metric) {
  return (metric.validationIssues?.length ?? 0) > 0;
}
function needsManualSplit(metric) {
  return metric.remediationMode === "SPLIT";
}
function shouldTableDrive(metric) {
  return (metric.recommendations ?? []).some((recommendation) => recommendation.kind === "TABLE_DRIVE") && (metric.extractionPressureScore ?? 0) === 0;
}
function shouldRefactorLocally(metric) {
  return metric.remediationMode === "LOCAL";
}
function aiActionability(metric) {
  if (hasValidationIssues(metric)) {
    return "REVIEW_FIRST";
  }
  if (needsManualSplit(metric)) {
    return "MANUAL_SPLIT";
  }
  if (shouldTableDrive(metric)) {
    return "AUTO_TABLE_DRIVE";
  }
  if (shouldRefactorLocally(metric)) {
    return "AUTO_REFACTOR";
  }
  return "LEAVE_ALONE";
}

// src/scrap/example/calls/duplicates.ts
function countedFingerprint(setup) {
  if (!setup.setupFingerprint || setup.setupLineCount < 2) {
    return void 0;
  }
  return setup.setupFingerprint;
}
function duplicateSetupGroupSizes(setups) {
  const counts = /* @__PURE__ */ new Map();
  for (const setup of setups) {
    const fingerprint = countedFingerprint(setup);
    if (fingerprint) {
      counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
    }
  }
  return setups.map((setup) => {
    const fingerprint = countedFingerprint(setup);
    return fingerprint ? counts.get(fingerprint) ?? 0 : 0;
  });
}
function duplicateSetupExampleCount(groupSizes) {
  return groupSizes.filter((groupSize) => groupSize > 1).length;
}

// src/scrap/example/calls/extract.ts
import * as ts11 from "typescript";

// src/scrap/calls/names.ts
import * as ts10 from "typescript";
function callInfo(expression) {
  if (ts10.isIdentifier(expression)) {
    return { baseName: expression.text, tableDriven: false };
  }
  if (ts10.isPropertyAccessExpression(expression)) {
    const parent = callInfo(expression.expression);
    return {
      baseName: parent.baseName,
      tableDriven: parent.tableDriven || expression.name.text === "each"
    };
  }
  if (ts10.isCallExpression(expression)) {
    return callInfo(expression.expression);
  }
  return { baseName: void 0, tableDriven: false };
}
function baseCallName(expression) {
  return callInfo(expression).baseName;
}
function terminalCallName(expression) {
  if (ts10.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts10.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  if (ts10.isCallExpression(expression)) {
    return terminalCallName(expression.expression);
  }
  return void 0;
}
function literalName(node) {
  return ts10.isStringLiteralLike(node) ? node.text : "(anonymous)";
}
function callbackArgument(node) {
  return node.arguments.find((argument) => ts10.isArrowFunction(argument) || ts10.isFunctionExpression(argument));
}

// src/scrap/example/calls/extract.ts
var BRANCHING_KINDS2 = /* @__PURE__ */ new Set([
  ts11.SyntaxKind.IfStatement,
  ts11.SyntaxKind.ForStatement,
  ts11.SyntaxKind.ForInStatement,
  ts11.SyntaxKind.ForOfStatement,
  ts11.SyntaxKind.WhileStatement,
  ts11.SyntaxKind.DoStatement,
  ts11.SyntaxKind.SwitchStatement,
  ts11.SyntaxKind.ConditionalExpression
]);
function isExpectCall(node) {
  return ts11.isIdentifier(node.expression) && node.expression.text === "expect";
}
function isTypeOnlyAssertionCall(node) {
  const terminal = terminalCallName(node.expression);
  return terminal === "assertType" || ts11.isPropertyAccessExpression(node.expression) && baseCallName(node.expression) === "expectTypeOf";
}
function isAssertionCall(node) {
  return isExpectCall(node) || isTypeOnlyAssertionCall(node);
}
function isMockCall(node) {
  return ts11.isPropertyAccessExpression(node.expression) && ts11.isIdentifier(node.expression.expression) && ["vi", "jest"].includes(node.expression.expression.text) && ["mock", "spyOn"].includes(node.expression.name.text);
}
function countBranches(node) {
  let total = BRANCHING_KINDS2.has(node.kind) ? 1 : 0;
  ts11.forEachChild(node, (child) => {
    total += countBranches(child);
  });
  return total;
}
function collectCallCount(node, matcher) {
  let count = 0;
  function walk2(current) {
    if (ts11.isCallExpression(current) && matcher(current)) {
      count++;
    }
    ts11.forEachChild(current, walk2);
  }
  walk2(node);
  return count;
}

// src/scrap/example/setup.ts
import * as ts13 from "typescript";

// src/scrap/calls/normalizedShapes.ts
import * as ts12 from "typescript";
var NORMALIZED_LITERAL_KINDS = /* @__PURE__ */ new Set([
  ts12.SyntaxKind.StringLiteral,
  ts12.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts12.SyntaxKind.NumericLiteral,
  ts12.SyntaxKind.TrueKeyword,
  ts12.SyntaxKind.FalseKeyword,
  ts12.SyntaxKind.NullKeyword
]);
function isNormalizedLiteralKind(kind) {
  return NORMALIZED_LITERAL_KINDS.has(kind);
}
function normalizedLeafFingerprint(node) {
  if (ts12.isIdentifier(node)) {
    return "id";
  }
  if (isNormalizedLiteralKind(node.kind)) {
    return "lit";
  }
  return void 0;
}
function literalShapeLeafFingerprint(node) {
  if (ts12.isIdentifier(node)) {
    return node.text;
  }
  if (isNormalizedLiteralKind(node.kind)) {
    return "lit";
  }
  return void 0;
}
function fingerprintChildren(node, serializer) {
  const children = [];
  ts12.forEachChild(node, (child) => {
    children.push(serializer(child));
  });
  return children;
}
function fingerprintNodeWithLeaf(node, leafFingerprint) {
  const leaf = leafFingerprint(node);
  if (leaf) {
    return leaf;
  }
  return `${node.kind}[${fingerprintChildren(node, (child) => fingerprintNodeWithLeaf(child, leafFingerprint)).join(",")}]`;
}
function fingerprintNode(node) {
  return fingerprintNodeWithLeaf(node, normalizedLeafFingerprint);
}
function collectFeatures(node, features, serializer) {
  features.add(serializer(node));
  ts12.forEachChild(node, (child) => collectFeatures(child, features, serializer));
}
function statementFingerprintWithSerializer(statements, serializer) {
  if (statements.length === 0) {
    return void 0;
  }
  return statements.map((statement) => serializer(statement)).join("|");
}
function statementFingerprint(statements) {
  return statementFingerprintWithSerializer(statements, fingerprintNode);
}
function literalShapeFingerprint(statements) {
  return statementFingerprintWithSerializer(
    statements,
    (statement) => fingerprintNodeWithLeaf(statement, literalShapeLeafFingerprint)
  );
}
function statementFeatures(statements) {
  const features = /* @__PURE__ */ new Set();
  statements.forEach((statement) => collectFeatures(statement, features, fingerprintNode));
  return [...features].sort();
}

// src/scrap/example/setup.ts
function statementLineCount(sourceFile, statement) {
  const start = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(statement.getEnd());
  return end.line - start.line + 1;
}
function bodyStatements(example) {
  const body = example.body.body;
  if (!body || !ts13.isBlock(body)) {
    return [];
  }
  return [...body.statements];
}
function setupStatements(example) {
  const statements = [];
  for (const statement of bodyStatements(example)) {
    if (collectCallCount(statement, isAssertionCall) > 0) {
      break;
    }
    statements.push(statement);
  }
  return statements;
}
function assertionStatements(example) {
  const statements = bodyStatements(example);
  const firstAssertionIndex = statements.findIndex((statement) => collectCallCount(statement, isAssertionCall) > 0);
  if (firstAssertionIndex === -1) {
    return [];
  }
  return statements.slice(firstAssertionIndex);
}
function allExampleStatements(example) {
  return bodyStatements(example);
}
function analyzeExampleSetup(sourceFile, example) {
  const statements = setupStatements(example);
  return {
    setupFingerprint: statementFingerprint(statements),
    setupLineCount: statements.reduce(
      (total, statement) => total + statementLineCount(sourceFile, statement),
      0
    )
  };
}

// src/scrap/example/signals.ts
import * as ts17 from "typescript";

// src/scrap/analysis/vitestSignals.ts
import * as ts16 from "typescript";

// src/scrap/vitest/asyncMatchers.ts
import * as ts15 from "typescript";

// src/scrap/calls/propertyMatcher.ts
import * as ts14 from "typescript";
function hasPropertyName(expression, name) {
  if (ts14.isCallExpression(expression)) {
    return hasPropertyName(expression.expression, name);
  }
  if (!ts14.isPropertyAccessExpression(expression)) {
    return false;
  }
  return expression.name.text === name || hasPropertyName(expression.expression, name);
}
function matchesTerminalName(expression, names) {
  const name = terminalCallName(expression);
  if (name === void 0) {
    return false;
  }
  return names.has(name);
}

// src/scrap/vitest/asyncMatchers.ts
var ASYNC_WAIT_CALLS = /* @__PURE__ */ new Set([
  "waitFor",
  "waitForElementToBeRemoved"
]);
var CONCURRENT_BASE_CALLS = /* @__PURE__ */ new Set([
  "describe",
  "it",
  "test"
]);
function isAsyncWaitCall(node) {
  const terminal = terminalCallName(node.expression);
  return terminal !== void 0 && (ASYNC_WAIT_CALLS.has(terminal) || terminal.startsWith("findBy") || terminal.startsWith("findAllBy"));
}
function isConcurrencyCall(node) {
  return ts15.isPropertyAccessExpression(node.expression) && hasPropertyName(node.expression, "concurrent") && CONCURRENT_BASE_CALLS.has(baseCallName(node.expression) ?? "");
}

// src/scrap/vitest/mutationMatchers.ts
var ENV_MUTATION_CALLS = /* @__PURE__ */ new Set([
  "stubEnv",
  "stubGlobal",
  "unstubAllEnvs",
  "unstubAllGlobals"
]);
var FAKE_TIMER_CALLS = /* @__PURE__ */ new Set([
  "setSystemTime",
  "useFakeTimers",
  "useRealTimers"
]);
var MODULE_MOCK_CALLS = /* @__PURE__ */ new Set([
  "doMock",
  "doUnmock",
  "hoisted",
  "importActual",
  "importMock",
  "mocked",
  "unmock"
]);
var SNAPSHOT_CALLS = /* @__PURE__ */ new Set([
  "toMatchInlineSnapshot",
  "toMatchSnapshot"
]);
function isEnvironmentMutationCall(node) {
  return baseCallName(node.expression) === "vi" && matchesTerminalName(node.expression, ENV_MUTATION_CALLS);
}
function isFakeTimerMutationCall(node) {
  return baseCallName(node.expression) === "vi" && matchesTerminalName(node.expression, FAKE_TIMER_CALLS);
}
function isModuleMockLifecycleCall(node) {
  return baseCallName(node.expression) === "vi" && matchesTerminalName(node.expression, MODULE_MOCK_CALLS);
}
function isSnapshotCall(node) {
  return matchesTerminalName(node.expression, SNAPSHOT_CALLS);
}

// src/scrap/analysis/vitestSignals.ts
function countConcurrentAncestors(node) {
  let count = 0;
  let parent = node.parent;
  while (parent) {
    if (ts16.isCallExpression(parent) && isConcurrencyCall(parent)) {
      count += 1;
    }
    parent = parent.parent;
  }
  return count;
}
function analyzeVitestSignals(node) {
  return {
    asyncWaitCount: collectCallCount(node, isAsyncWaitCall),
    concurrencyCount: collectCallCount(node, isConcurrencyCall) + countConcurrentAncestors(node),
    envMutationCount: collectCallCount(node, isEnvironmentMutationCall),
    fakeTimerCount: collectCallCount(node, isFakeTimerMutationCall),
    moduleMockCount: collectCallCount(node, isModuleMockLifecycleCall),
    snapshotCount: collectCallCount(node, isSnapshotCall),
    typeOnlyAssertionCount: collectCallCount(node, isTypeOnlyAssertionCall)
  };
}

// src/scrap/calls/resources.ts
var TEMP_RESOURCE_CALLS = /* @__PURE__ */ new Set([
  "mkdtemp",
  "mkdtempSync",
  "mkdir",
  "mkdirSync",
  "tmpdir",
  "writeFile",
  "writeFileSync"
]);
function isTempResourceCallName(callName) {
  return TEMP_RESOURCE_CALLS.has(callName);
}

// src/scrap/example/signals.ts
var DEPTH_KINDS = /* @__PURE__ */ new Set([
  ts17.SyntaxKind.IfStatement,
  ts17.SyntaxKind.ForStatement,
  ts17.SyntaxKind.ForInStatement,
  ts17.SyntaxKind.ForOfStatement,
  ts17.SyntaxKind.WhileStatement,
  ts17.SyntaxKind.DoStatement,
  ts17.SyntaxKind.SwitchStatement,
  ts17.SyntaxKind.TryStatement,
  ts17.SyntaxKind.ConditionalExpression
]);
function isBranchNode(node) {
  return DEPTH_KINDS.has(node.kind);
}
function maxSetupDepth(node, depth = 0) {
  const branchDepth = isBranchNode(node) ? depth + 1 : depth;
  let maxDepth = branchDepth;
  ts17.forEachChild(node, (child) => {
    maxDepth = Math.max(maxDepth, maxSetupDepth(child, branchDepth));
  });
  return maxDepth;
}
function countTempResourceWork(node) {
  let count = 0;
  function walk2(current) {
    if (ts17.isCallExpression(current)) {
      const callName = terminalCallName(current.expression);
      if (isTempResourceCallName(callName)) {
        count += 1;
      }
    }
    ts17.forEachChild(current, walk2);
  }
  walk2(node);
  return count;
}

// src/scrap/calls/fixture.ts
import * as ts18 from "typescript";
function hasFixtureCall(node) {
  let found = false;
  function walk2(current) {
    if (ts18.isCallExpression(current)) {
      const callName = terminalCallName(current.expression);
      if (isTempResourceCallName(callName)) {
        found = true;
        return;
      }
    }
    ts18.forEachChild(current, walk2);
  }
  walk2(node);
  return found;
}
function fixtureStatements(node) {
  const statements = [];
  ts18.forEachChild(node, (child) => {
    if (ts18.isStatement(child) && hasFixtureCall(child)) {
      statements.push(child);
    }
    if (ts18.isFunctionLike(child)) {
      statements.push(...fixtureStatements(child));
      return;
    }
    if (ts18.isBlock(child)) {
      statements.push(...fixtureStatements(child));
    }
  });
  return statements;
}

// src/scrap/structure/helpers/definitions.ts
import * as ts20 from "typescript";

// src/scrap/structure/helpers/containers.ts
import * as ts19 from "typescript";
function findHelperContainer(node) {
  for (let current = node; current; current = current.parent) {
    if (ts19.isBlock(current) || ts19.isSourceFile(current)) {
      return current;
    }
  }
  return void 0;
}
function ancestorHelperContainers(node) {
  const containers = [];
  for (let current = findHelperContainer(node.parent); current; current = findHelperContainer(current.parent)) {
    containers.push(current);
  }
  return containers;
}

// src/scrap/structure/helpers/definitions.ts
function helperLineCount(sourceFile, helper) {
  const start = sourceFile.getLineAndCharacterOfPosition(helper.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(helper.getEnd());
  return end.line - start.line + 1;
}
function createHelperDefinition(sourceFile, name, helper, container) {
  return {
    body: helper,
    container,
    key: `${name}:${helper.getStart()}:${helper.getEnd()}`,
    lineCount: helperLineCount(sourceFile, helper),
    name
  };
}
function functionDeclarationDefinition(sourceFile, node) {
  if (!node.name || !node.body) {
    return void 0;
  }
  const container = findHelperContainer(node.parent);
  if (!container) {
    return void 0;
  }
  return createHelperDefinition(sourceFile, node.name.text, node, container);
}
function functionInitializer(declaration) {
  const { initializer } = declaration;
  if (initializer && (ts20.isArrowFunction(initializer) || ts20.isFunctionExpression(initializer))) {
    return initializer;
  }
  return void 0;
}
function variableDeclarationDefinition(sourceFile, node) {
  if (!ts20.isIdentifier(node.name)) {
    return void 0;
  }
  const initializer = functionInitializer(node);
  const container = findHelperContainer(node.parent);
  if (!initializer || !container) {
    return void 0;
  }
  return createHelperDefinition(sourceFile, node.name.text, initializer, container);
}
function collectDefinition(sourceFile, node) {
  if (ts20.isFunctionDeclaration(node)) {
    return functionDeclarationDefinition(sourceFile, node);
  }
  if (ts20.isVariableDeclaration(node)) {
    return variableDeclarationDefinition(sourceFile, node);
  }
  return void 0;
}
function collectHelperDefinitions(sourceFile) {
  const definitions = [];
  function walk2(node) {
    const definition = collectDefinition(sourceFile, node);
    if (definition) {
      definitions.push(definition);
    }
    ts20.forEachChild(node, walk2);
  }
  walk2(sourceFile);
  return definitions;
}

// src/scrap/structure/helpers/reachability.ts
import * as ts21 from "typescript";
function helpersInContainer(container, helpers) {
  return helpers.filter((helper) => helper.container === container);
}
function visibleHelpers(scopeNode, helpers) {
  const visible = /* @__PURE__ */ new Map();
  for (const container of ancestorHelperContainers(scopeNode)) {
    for (const helper of helpersInContainer(container, helpers)) {
      if (!visible.has(helper.name)) {
        visible.set(helper.name, helper);
      }
    }
  }
  return visible;
}
function directHelperCalls(scopeNode, helpers) {
  const body = scopeNode.body;
  if (!body) {
    return [];
  }
  const calls = [];
  const visible = visibleHelpers(scopeNode, helpers);
  function visitCall(node) {
    if (ts21.isCallExpression(node) && ts21.isIdentifier(node.expression)) {
      const helper = visible.get(node.expression.text);
      if (helper) {
        calls.push(helper);
      }
    }
    ts21.forEachChild(node, visitCall);
  }
  visitCall(body);
  return calls;
}
function appendReachableHelpers(helper, helpers, visited, reachable) {
  if (visited.has(helper.key)) {
    return;
  }
  visited.add(helper.key);
  reachable.push(helper);
  for (const nestedHelper of directHelperCalls(helper.body, helpers)) {
    appendReachableHelpers(nestedHelper, helpers, visited, reachable);
  }
}
function reachableHelpers(scopeNode, helpers, visited = /* @__PURE__ */ new Set()) {
  const reachable = [];
  for (const helper of directHelperCalls(scopeNode, helpers)) {
    appendReachableHelpers(helper, helpers, visited, reachable);
  }
  return reachable;
}

// src/scrap/structure/helpers/usage.ts
function analyzeHelperUsage(sourceFile, example) {
  const helpers = collectHelperDefinitions(sourceFile);
  const directCalls = directHelperCalls(example.body, helpers);
  const hiddenHelpers = reachableHelpers(example.body, helpers, /* @__PURE__ */ new Set());
  return {
    helperCallCount: directCalls.length,
    helperHiddenLineCount: hiddenHelpers.reduce((total, helper) => total + helper.lineCount, 0)
  };
}

// src/scrap/analysis/rtlSignals.ts
var QUERY_PREFIXES = ["findAllBy", "findBy", "getAllBy", "getBy", "queryAllBy", "queryBy"];
var RENDER_CALLS = /* @__PURE__ */ new Set([
  "render",
  "renderHook",
  "rerender"
]);
var MUTATION_BASE_CALLS = /* @__PURE__ */ new Set([
  "fireEvent",
  "userEvent"
]);
function hasQueryPrefix(terminal) {
  return QUERY_PREFIXES.some((prefix) => terminal?.startsWith(prefix) ?? false);
}
function isRtlQueryCall(node) {
  return hasQueryPrefix(terminalCallName(node.expression));
}
function isRtlRenderCall(node) {
  return RENDER_CALLS.has(terminalCallName(node.expression) ?? "");
}
function isRtlMutationCall(node) {
  return MUTATION_BASE_CALLS.has(baseCallName(node.expression) ?? "") || terminalCallName(node.expression) === "rerender";
}
function analyzeRtlSignals(node) {
  return {
    rtlMutationCount: collectCallCount(node, isRtlMutationCall),
    rtlQueryCount: collectCallCount(node, isRtlQueryCall),
    rtlRenderCount: collectCallCount(node, isRtlRenderCall)
  };
}

// src/scrap/example/calls/pressure.ts
function linePressure(lineCount) {
  return Math.max(0, Math.min(6, Math.ceil((lineCount - 8) / 6)));
}
function assertionPressure(assertionCount) {
  if (assertionCount === 0) {
    return 8;
  }
  return assertionCount === 1 ? 3 : 0;
}
function branchPressure(branchCount) {
  return Math.min(6, branchCount * 2);
}
function mockPressure(mockCount) {
  return Math.min(4, mockCount);
}
function helperHiddenPressure(helperHiddenLineCount) {
  return Math.max(0, Math.min(6, Math.ceil((helperHiddenLineCount - 4) / 6)));
}
function duplicateSetupPressure(duplicateSetupGroupSize, setupLineCount) {
  if (duplicateSetupGroupSize < 2 || setupLineCount < 2) {
    return 0;
  }
  return Math.min(4, duplicateSetupGroupSize - 1 + Math.floor((setupLineCount - 2) / 3));
}
function nestingPressure(describeDepth) {
  return Math.max(0, describeDepth - 2);
}

// src/scrap/vitest/pressure.ts
function asyncWaitPressure(asyncWaitCount) {
  return Math.min(4, asyncWaitCount);
}
function concurrencyPressure(concurrencyCount) {
  return Math.min(2, concurrencyCount);
}
function environmentMutationPressure(envMutationCount, fakeTimerCount) {
  return Math.min(3, envMutationCount + fakeTimerCount);
}
function moduleMockPressure(moduleMockCount) {
  return Math.min(3, moduleMockCount);
}
function snapshotPressure(snapshotCount) {
  return Math.max(0, Math.min(4, snapshotCount - 1));
}
function rtlQueryPressure(rtlRenderCount, rtlQueryCount, rtlMutationCount) {
  if (rtlRenderCount === 0 || rtlMutationCount > 0 || rtlQueryCount < 3) {
    return 0;
  }
  return Math.min(3, rtlQueryCount - 2);
}
function vitestOperationalPressure(snapshotCount, asyncWaitCount, fakeTimerCount, envMutationCount, concurrencyCount, moduleMockCount = 0, rtlRenderCount = 0, rtlQueryCount = 0, rtlMutationCount = 0) {
  return snapshotPressure(snapshotCount) + asyncWaitPressure(asyncWaitCount) + environmentMutationPressure(envMutationCount, fakeTimerCount) + concurrencyPressure(concurrencyCount) + moduleMockPressure(moduleMockCount) + rtlQueryPressure(rtlRenderCount, rtlQueryCount, rtlMutationCount);
}

// src/scrap/analysis/examples/score.ts
function structuralPressures(metric) {
  return linePressure(metric.lineCount) + branchPressure(metric.branchCount) + nestingPressure(metric.describeDepth);
}
function setupRelatedPressures(metric) {
  return duplicateSetupPressure(metric.duplicateSetupGroupSize, metric.setupLineCount) + Math.max(0, defaultZero(metric.setupDepth) - 1);
}
function qualityPressures(metric) {
  return helperHiddenPressure(metric.helperHiddenLineCount) + assertionPressure(metric.assertionCount) + mockPressure(metric.mockCount);
}
function defaultZero(value) {
  return value ?? 0;
}
function operationalPressures(metric) {
  const vitestPressure = vitestOperationalPressure(
    defaultZero(metric.snapshotCount),
    defaultZero(metric.asyncWaitCount),
    defaultZero(metric.fakeTimerCount),
    defaultZero(metric.envMutationCount),
    defaultZero(metric.concurrencyCount),
    defaultZero(metric.moduleMockCount),
    defaultZero(metric.rtlRenderCount),
    defaultZero(metric.rtlQueryCount),
    defaultZero(metric.rtlMutationCount)
  );
  return vitestPressure + Math.min(3, defaultZero(metric.tempResourceCount));
}
function scoreExample(metric) {
  return structuralPressures(metric) + setupRelatedPressures(metric) + qualityPressures(metric) + operationalPressures(metric);
}

// src/scrap/calls/subjectNames.ts
import * as ts22 from "typescript";
var EXCLUDED_SUBJECTS = /* @__PURE__ */ new Set([
  "act",
  "afterAll",
  "afterEach",
  "beforeAll",
  "beforeEach",
  "describe",
  "expect",
  "expectTypeOf",
  "it",
  "jest",
  "screen",
  "test",
  "vi",
  "waitFor"
]);
function collectSubjects(nodes) {
  const subjects = /* @__PURE__ */ new Set();
  function walk2(current) {
    if (ts22.isCallExpression(current)) {
      const subject = baseCallName(current.expression);
      if (subject && !EXCLUDED_SUBJECTS.has(subject)) {
        subjects.add(subject);
      }
    }
    ts22.forEachChild(current, walk2);
  }
  nodes.forEach(walk2);
  return [...subjects].sort();
}
function collectSubjectNames(node) {
  return collectSubjects([node]);
}
function collectStatementSubjectNames(statements) {
  return collectSubjects(statements);
}

// src/scrap/example/metrics.ts
function analyzeExample(sourceFile, example, setupMetric = analyzeExampleSetup(sourceFile, example)) {
  const start = sourceFile.getLineAndCharacterOfPosition(example.body.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(example.body.getEnd());
  const helperUsage = analyzeHelperUsage(sourceFile, example);
  const rtlSignals = analyzeRtlSignals(example.body);
  const vitestSignals = analyzeVitestSignals(example.body);
  const setupNodes = setupStatements(example);
  const fixtureNodes = fixtureStatements(example.body);
  const assertionNodes = assertionStatements(example);
  const allNodes = allExampleStatements(example);
  const setupDepth = setupNodes.reduce(
    (maxDepth, statement) => Math.max(maxDepth, maxSetupDepth(statement)),
    0
  );
  const baseMetric = {
    assertionCount: collectCallCount(example.body, isAssertionCall),
    assertionFeatures: statementFeatures(assertionNodes),
    assertionFingerprint: statementFingerprint(assertionNodes),
    blockPath: example.blockPath,
    branchCount: countBranches(example.body),
    describeDepth: example.describeDepth,
    duplicateSetupGroupSize: 0,
    endLine: end.line + 1,
    exampleFeatures: statementFeatures(allNodes),
    exampleFingerprint: statementFingerprint(allNodes),
    fixtureFeatures: statementFeatures(fixtureNodes),
    fixtureFingerprint: statementFingerprint(fixtureNodes),
    literalShapeFingerprint: literalShapeFingerprint(allNodes),
    asyncWaitCount: vitestSignals.asyncWaitCount,
    concurrencyCount: vitestSignals.concurrencyCount,
    envMutationCount: vitestSignals.envMutationCount,
    helperCallCount: helperUsage.helperCallCount,
    helperHiddenLineCount: helperUsage.helperHiddenLineCount,
    lineCount: end.line - start.line + 1,
    fakeTimerCount: vitestSignals.fakeTimerCount,
    moduleMockCount: vitestSignals.moduleMockCount,
    mockCount: collectCallCount(example.body, isMockCall),
    name: example.name,
    rtlMutationCount: rtlSignals.rtlMutationCount,
    rtlQueryCount: rtlSignals.rtlQueryCount,
    rtlRenderCount: rtlSignals.rtlRenderCount,
    snapshotCount: vitestSignals.snapshotCount,
    setupDepth,
    setupFeatures: statementFeatures(setupNodes),
    setupFingerprint: setupMetric.setupFingerprint,
    setupLineCount: setupMetric.setupLineCount,
    setupSubjectNames: collectStatementSubjectNames(setupNodes),
    startLine: start.line + 1,
    subjectNames: collectSubjectNames(example.body),
    tableDriven: example.tableDriven,
    typeOnlyAssertionCount: vitestSignals.typeOnlyAssertionCount,
    tempResourceCount: countTempResourceWork(example.body)
  };
  return {
    ...baseMetric,
    score: scoreExample(baseMetric)
  };
}

// src/scrap/analysis/examples/find.ts
import * as ts23 from "typescript";
function exampleNode(node, describeDepth, blockPath) {
  const info = callInfo(node.expression);
  const callback = callbackArgument(node);
  if (!callback || info.baseName !== "it" && info.baseName !== "test") {
    return void 0;
  }
  return {
    body: callback,
    blockPath,
    describeDepth,
    name: literalName(node.arguments[0] ?? node),
    tableDriven: info.tableDriven
  };
}
function nestedDescribe(node) {
  const info = callInfo(node.expression);
  const callback = callbackArgument(node);
  if (!callback || info.baseName !== "describe" && info.baseName !== "context") {
    return void 0;
  }
  return {
    body: callback,
    name: literalName(node.arguments[0] ?? node)
  };
}
function findExamples(sourceFile) {
  const examples = [];
  function walk2(node, describeDepth, blockPath) {
    if (ts23.isCallExpression(node)) {
      const describeBlock = nestedDescribe(node);
      if (describeBlock) {
        walk2(describeBlock.body, describeDepth + 1, [...blockPath, describeBlock.name]);
        return;
      }
      const example = exampleNode(node, describeDepth, blockPath);
      if (example) {
        examples.push(example);
      }
    }
    ts23.forEachChild(node, (child) => walk2(child, describeDepth, blockPath));
  }
  walk2(sourceFile, 0, []);
  return examples;
}

// src/scrap/analysis/examples/scored.ts
function analyzeFileExamples(sourceFile) {
  const examples = findExamples(sourceFile);
  const setupMetrics = examples.map((example) => analyzeExampleSetup(sourceFile, example));
  const duplicateGroupSizes = duplicateSetupGroupSizes(setupMetrics);
  return examples.map((example, index) => {
    const metric = analyzeExample(sourceFile, example, setupMetrics[index]);
    const duplicateSetupGroupSize = duplicateGroupSizes[index] ?? 0;
    return {
      ...metric,
      duplicateSetupGroupSize,
      score: scoreExample({
        ...metric,
        duplicateSetupGroupSize
      })
    };
  });
}

// src/scrap/example/countSummary.ts
function countExamples(examples, predicate) {
  return examples.filter(predicate).length;
}
function summarizeExampleCounts(examples) {
  return {
    branchingExampleCount: countExamples(examples, (example) => example.branchCount > 0),
    duplicateSetupGroupSizes: examples.map((example) => example.duplicateSetupGroupSize),
    helperHiddenExampleCount: countExamples(examples, (example) => example.helperHiddenLineCount > 0),
    lowAssertionExampleCount: countExamples(examples, (example) => example.assertionCount <= 1),
    tableDrivenExampleCount: countExamples(examples, (example) => example.tableDriven === true),
    tempResourceExampleCount: countExamples(examples, (example) => (example.tempResourceCount ?? 0) > 0),
    zeroAssertionExampleCount: countExamples(examples, (example) => example.assertionCount === 0)
  };
}

// src/scrap/example/scoreSummary.ts
function totalScore(examples) {
  return examples.reduce((sum, example) => sum + example.score, 0);
}
function averageScore(examples) {
  if (examples.length === 0) {
    return 0;
  }
  return totalScore(examples) / examples.length;
}
function maxScore(examples) {
  return examples.reduce((max, example) => Math.max(max, example.score), 0);
}
function hotExampleCount(examples, threshold = 8) {
  return examples.filter((example) => example.score >= threshold).length;
}
function worstExamples(examples) {
  return [...examples].sort((left, right) => right.score - left.score).slice(0, 5);
}
function roundScore(value) {
  return Math.round(value * 100) / 100;
}

// src/scrap/metrics/average/jaccard.ts
function similaritySet(features) {
  return new Set(features ?? []);
}
function jaccardSimilarity(left, right) {
  const leftSet = similaritySet(left);
  const rightSet = similaritySet(right);
  let intersection = 0;
  leftSet.forEach((feature) => {
    if (rightSet.has(feature)) {
      intersection += 1;
    }
  });
  const union = (/* @__PURE__ */ new Set([...leftSet, ...rightSet])).size;
  if (union === 0) {
    return 0;
  }
  return intersection / union;
}

// src/scrap/metrics/average/edges.ts
function addSimilarityEdge(edges, left, right) {
  edges.get(left).push(right);
  edges.get(right).push(left);
}
function buildSimilarityEdges(featureLists, threshold) {
  const edges = /* @__PURE__ */ new Map();
  featureLists.forEach((features, index) => {
    if ((features?.length ?? 0) > 0) {
      edges.set(index, []);
    }
  });
  featureLists.forEach((leftFeatures, left) => {
    featureLists.slice(left + 1).forEach((rightFeatures, offset) => {
      const right = left + offset + 1;
      if (jaccardSimilarity(leftFeatures, rightFeatures) >= threshold) {
        addSimilarityEdge(edges, left, right);
      }
    });
  });
  return edges;
}

// src/scrap/metrics/average/components.ts
function collectComponent(start, edges, visited) {
  const stack = [start];
  const component = [];
  const queued = /* @__PURE__ */ new Set([start]);
  visited.add(start);
  for (let index = 0; index < stack.length; index++) {
    const current = stack[index];
    component.push(current);
    for (const neighbor of edges.get(current) ?? []) {
      if (queued.has(neighbor)) {
        continue;
      }
      queued.add(neighbor);
      visited.add(neighbor);
      stack.push(neighbor);
    }
  }
  return component;
}
function connectedComponents(featureLists, threshold) {
  const edges = buildSimilarityEdges(featureLists, threshold);
  const visited = /* @__PURE__ */ new Set();
  const components = [];
  for (const start of edges.keys()) {
    if (!visited.has(start)) {
      components.push(collectComponent(start, edges, visited));
    }
  }
  return components;
}

// src/scrap/metrics/average/pairwise.ts
function pairwiseSimilarity(featureLists) {
  let total = 0;
  let pairs = 0;
  featureLists.forEach((leftFeatures, left) => {
    featureLists.slice(left + 1).forEach((rightFeatures) => {
      total += jaccardSimilarity(leftFeatures, rightFeatures);
      pairs += 1;
    });
  });
  return pairs === 0 ? 0 : total / pairs;
}

// src/scrap/metrics/average/groups.ts
function featureGroupSizes(featureLists, threshold = 0.5) {
  const sizes = Array.from({ length: featureLists.length }, () => 0);
  connectedComponents(featureLists, threshold).forEach((component) => {
    component.forEach((index) => {
      sizes[index] = component.length;
    });
  });
  return sizes;
}
function shapeDiversity(featureLists, threshold = 0.5) {
  return connectedComponents(featureLists, threshold).length;
}

// src/scrap/metrics/compute.ts
function distinctSubjectCount(examples) {
  const subjects = new Set(examples.flatMap((example) => example.subjectNames ?? []));
  return subjects.size;
}
function subjectRepetitionScore(examples) {
  const counts = /* @__PURE__ */ new Map();
  examples.flatMap((example) => example.subjectNames ?? []).forEach((subject) => {
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  });
  return [...counts.values()].filter((count) => count > 1).length;
}
function analyzeCohesionMetrics(examples) {
  const assertionFeatures = examples.map((example) => example.assertionFeatures);
  const exampleFeatures = examples.map((example) => example.exampleFeatures);
  const fixtureFeatures = examples.map((example) => example.fixtureFeatures);
  const setupFeatures = examples.map((example) => example.setupFeatures);
  const subjectSets = examples.map((example) => example.subjectNames);
  return {
    assertionShapeDiversity: shapeDiversity(assertionFeatures),
    averageAssertionSimilarity: pairwiseSimilarity(assertionFeatures),
    averageExampleSimilarity: pairwiseSimilarity(exampleFeatures),
    averageFixtureSimilarity: pairwiseSimilarity(fixtureFeatures),
    averageSetupSimilarity: pairwiseSimilarity(setupFeatures),
    averageSubjectOverlap: pairwiseSimilarity(subjectSets),
    distinctSubjectCount: distinctSubjectCount(examples),
    exampleShapeDiversity: shapeDiversity(exampleFeatures),
    fixtureShapeDiversity: shapeDiversity(fixtureFeatures),
    setupShapeDiversity: shapeDiversity(setupFeatures),
    subjectRepetitionScore: subjectRepetitionScore(examples)
  };
}

// src/scrap/metrics/cohesionPredicates.ts
function hasBroadSubjectSpread(cohesion, exampleCount) {
  return exampleCount >= 7 && cohesion.distinctSubjectCount >= 4 && cohesion.averageSubjectOverlap <= 0.1;
}
function hasShapeDrift(cohesion, exampleCount) {
  return exampleCount >= 7 && cohesion.exampleShapeDiversity >= 3 && cohesion.averageExampleSimilarity <= 0.2 && cohesion.subjectRepetitionScore <= 1;
}

// src/scrap/metrics/recommendations.ts
function buildReasonMessage(cohesion, isBroadSpread) {
  if (isBroadSpread) {
    return `Examples touch ${cohesion.distinctSubjectCount} distinct subjects with little overlap.`;
  }
  return `Examples vary structurally (diversity ${cohesion.exampleShapeDiversity}) with low similarity (${cohesion.averageExampleSimilarity}).`;
}
function cohesionRecommendations(cohesion, exampleCount) {
  const broadSubjectSpread = hasBroadSubjectSpread(cohesion, exampleCount);
  const shapeDrift = hasShapeDrift(cohesion, exampleCount);
  if (broadSubjectSpread || shapeDrift) {
    const reason = buildReasonMessage(cohesion, broadSubjectSpread);
    return [{
      confidence: "LOW",
      kind: "REVIEW_STRUCTURE",
      message: `${reason} Review whether this file mixes responsibilities.`
    }];
  }
  return [];
}

// src/scrap/policy/parseIssues.ts
function diagnosticLine(sourceFile, diagnostic) {
  return sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1;
}
function diagnosticSegments(messageText) {
  if (typeof messageText === "string") {
    return [messageText];
  }
  return [
    messageText.messageText,
    ...(messageText.next ?? []).flatMap((segment) => diagnosticSegments(segment))
  ];
}
function diagnosticMessage(diagnostic) {
  return diagnosticSegments(diagnostic.messageText).map((segment) => segment.trim()).filter((segment) => segment.length > 0).join(" ");
}
function parseDiagnostics(sourceFile) {
  return sourceFile.parseDiagnostics ?? [];
}
function parseIssues(sourceFile) {
  return parseDiagnostics(sourceFile).map((diagnostic) => ({
    kind: "parse",
    line: diagnosticLine(sourceFile, diagnostic),
    message: diagnosticMessage(diagnostic)
  }));
}

// src/scrap/policy/structureIssues.ts
import * as ts24 from "typescript";

// src/scrap/example/calls/callKinds.ts
function isExampleCallName(callName) {
  return callName === "it" || callName === "test";
}
function nextInsideExampleState(insideExample, callName) {
  return insideExample || isExampleCallName(callName);
}

// src/scrap/calls/structureCallKinds.ts
function isHookCallName(callName) {
  return callName === "afterAll" || callName === "afterEach" || callName === "beforeAll" || callName === "beforeEach";
}
function isStructureCallName(callName) {
  return callName === "context" || callName === "describe";
}
function isHookOrStructureCallName(callName) {
  return typeof callName === "string" && (isHookCallName(callName) || isStructureCallName(callName));
}

// src/scrap/policy/structureIssues.ts
function issueLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}
function issue(sourceFile, node, kind, message) {
  return {
    kind,
    line: issueLine(sourceFile, node),
    message
  };
}
function nestedExampleIssue(sourceFile, node, callName) {
  return issue(
    sourceFile,
    node,
    "nested-test",
    `Nested ${callName} call inside another test body.`
  );
}
function misplacedStructureIssue(sourceFile, node, callName) {
  return issue(
    sourceFile,
    node,
    "hook-in-test",
    `${callName} call inside a test body should be lifted out of the example.`
  );
}
function issuesForCall(sourceFile, node, insideExample) {
  const callName = baseCallName(node.expression);
  if (!insideExample || !callName) {
    return [];
  }
  if (isExampleCallName(callName)) {
    return [nestedExampleIssue(sourceFile, node, callName)];
  }
  if (isHookOrStructureCallName(callName) && callbackArgument(node)) {
    return [misplacedStructureIssue(sourceFile, node, callName)];
  }
  return [];
}
function walk(sourceFile, node, insideExample, issues) {
  if (ts24.isCallExpression(node)) {
    issues.push(...issuesForCall(sourceFile, node, insideExample));
    const callback = callbackArgument(node);
    if (callback) {
      walk(
        sourceFile,
        callback,
        nextInsideExampleState(insideExample, baseCallName(node.expression)),
        issues
      );
      return;
    }
  }
  ts24.forEachChild(node, (child) => walk(sourceFile, child, insideExample, issues));
}
function structureIssues(sourceFile) {
  const issues = [];
  walk(sourceFile, sourceFile, false, issues);
  return issues;
}

// src/scrap/policy/issues.ts
function validateScrapFile(sourceFile) {
  return [...parseIssues(sourceFile), ...structureIssues(sourceFile)];
}

// src/scrap/policy/remediationMode.ts
function remediationMode(exampleCount, averageScore3, hotExampleCount2, maxScore2) {
  if (hotExampleCount2 >= 10 || exampleCount >= 30 && averageScore3 >= 5 || exampleCount >= 50 && averageScore3 >= 4.25) {
    return "SPLIT";
  }
  if (maxScore2 >= 6 || averageScore3 >= 4) {
    return "LOCAL";
  }
  return "STABLE";
}

// src/scrap/structure/blocks/ordering.ts
function pathLabel(summary) {
  return summary.path.join(" > ");
}
function compareBlockSummaries(left, right) {
  return right.maxScore - left.maxScore || right.averageScore - left.averageScore || right.exampleCount - left.exampleCount || pathLabel(left).localeCompare(pathLabel(right));
}

// src/scrap/structure/blocks/groups.ts
var BLOCK_SEPARATOR = "";
function blockPathKey(path4) {
  return path4.join(BLOCK_SEPARATOR);
}
function blockPathFromKey(key) {
  return key.split(BLOCK_SEPARATOR);
}
function prefixBlockGroups(examples) {
  const groups = /* @__PURE__ */ new Map();
  examples.forEach((example) => {
    example.blockPath.forEach((_, depthIndex) => {
      const key = blockPathKey(example.blockPath.slice(0, depthIndex + 1));
      const group = groups.get(key) ?? [];
      group.push(example);
      groups.set(key, group);
    });
  });
  return groups;
}

// src/scrap/structure/blocks/metric.ts
function averageScore2(examples) {
  const total = examples.reduce((sum, example) => sum + example.score, 0);
  return total / examples.length;
}
function countExamples2(examples, predicate) {
  return examples.filter(predicate).length;
}
function summarizeBlock(path4, examples) {
  const meanScore = averageScore2(examples);
  const maxScore2 = examples.reduce((max, example) => Math.max(max, example.score), 0);
  const hotExampleCount2 = countExamples2(examples, (example) => example.score >= 8);
  return {
    averageScore: Math.round(meanScore * 100) / 100,
    branchingExampleCount: countExamples2(examples, (example) => example.branchCount > 0),
    duplicateSetupExampleCount: duplicateSetupExampleCount(
      examples.map((example) => example.duplicateSetupGroupSize)
    ),
    exampleCount: examples.length,
    helperHiddenExampleCount: countExamples2(examples, (example) => example.helperHiddenLineCount > 0),
    hotExampleCount: hotExampleCount2,
    lowAssertionExampleCount: countExamples2(examples, (example) => example.assertionCount <= 1),
    maxScore: maxScore2,
    name: path4[path4.length - 1],
    path: path4,
    remediationMode: remediationMode(examples.length, meanScore, hotExampleCount2, maxScore2),
    zeroAssertionExampleCount: countExamples2(examples, (example) => example.assertionCount === 0)
  };
}

// src/scrap/structure/blocks/summaries.ts
function summarizeBlocks(examples) {
  return [...prefixBlockGroups(examples).entries()].map(([key, group]) => summarizeBlock(blockPathFromKey(key), group)).sort(compareBlockSummaries);
}

// src/scrap/metrics/matrix/shape.ts
function hasLowNoiseStructure(example) {
  return example.branchCount <= 1 && example.helperHiddenLineCount === 0 && example.mockCount === 0;
}
function hasCompactCoverageShape(example) {
  return example.lineCount <= 12 && (example.setupLineCount ?? 0) <= 3 && (example.tempResourceCount ?? 0) <= 1 && example.assertionCount >= 1;
}
function isSimpleCoverageMatrixShape(example) {
  return hasLowNoiseStructure(example) && hasCompactCoverageShape(example);
}

// src/scrap/metrics/matrix/variation.ts
function hasStructuredVariation(example, literalShapeGroupSize = 0, fixtureGroupSize = 0) {
  return example.tableDriven === true || literalShapeGroupSize > 1 || fixtureGroupSize > 1;
}

// src/scrap/metrics/matrix/candidates.ts
function isCoverageMatrixCandidate(example, duplicateSize, literalShapeGroupSize = 0, fixtureGroupSize = 0) {
  if (duplicateSize <= 1) {
    return false;
  }
  if (example.tableDriven === true) {
    return true;
  }
  const structuredVariation = hasStructuredVariation(
    example,
    literalShapeGroupSize,
    fixtureGroupSize
  );
  return structuredVariation && isSimpleCoverageMatrixShape(example);
}
function coverageMatrixCandidateCount(examples, groupSizes) {
  return examples.filter((example, index) => isCoverageMatrixCandidate(
    example,
    groupSizes.exampleGroupSizes[index] ?? 0,
    groupSizes.literalShapeGroupSizes[index] ?? 0,
    groupSizes.fixtureGroupSizes[index] ?? 0
  )).length;
}
function tableDriveCandidateCount(examples, groupSizes) {
  return examples.filter((example, index) => example.tableDriven !== true && isCoverageMatrixCandidate(
    example,
    groupSizes.exampleGroupSizes[index] ?? 0,
    groupSizes.literalShapeGroupSizes[index] ?? 0,
    groupSizes.fixtureGroupSizes[index] ?? 0
  )).length;
}

// src/scrap/test/duplication/groupSizes.ts
function selectedFingerprint(example, selector) {
  return selector(example);
}
function countedFingerprintGroups(examples, selector) {
  const counts = /* @__PURE__ */ new Map();
  examples.forEach((example) => {
    const fingerprint = selectedFingerprint(example, selector);
    if (fingerprint) {
      counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
    }
  });
  return examples.map((example) => {
    const fingerprint = selectedFingerprint(example, selector);
    return fingerprint ? counts.get(fingerprint) ?? 0 : 0;
  });
}
function duplicateGroupCount(groupSizes) {
  return groupSizes.filter((groupSize) => groupSize > 1).length;
}

// src/scrap/example/clusters.ts
function isRepeatedSetupExample(example) {
  return example.duplicateSetupGroupSize > 1 && example.setupLineCount >= 2 && typeof example.setupFingerprint === "string";
}
function repeatedSetupExamples(examples) {
  return examples.filter(isRepeatedSetupExample);
}
function groupSetupExamples(examples) {
  const clusters = /* @__PURE__ */ new Map();
  repeatedSetupExamples(examples).forEach((example) => {
    const fingerprint = example.setupFingerprint;
    const cluster = clusters.get(fingerprint) ?? [];
    cluster.push(example);
    clusters.set(fingerprint, cluster);
  });
  return [...clusters.values()];
}
function strongestSetupCluster(examples) {
  return groupSetupExamples(examples).sort((left, right) => right.length - left.length)[0] ?? [];
}
function coverageRelevantExamples(examples) {
  return examples.filter(
    (example) => example.tableDriven === true || !!example.literalShapeFingerprint || !!example.fixtureFingerprint
  );
}

// src/scrap/report/blocks/recommendationText.ts
function uniqueNonEmptyValues(values) {
  return [...new Set(values)].filter((value) => value.length > 0);
}
function summarizeValues(label, values) {
  const summarized = uniqueNonEmptyValues(values).slice(0, 3);
  return summarized.length === 0 ? "" : ` ${label}: ${summarized.join(", ")}.`;
}
function summarizeBlockPaths(examples) {
  return summarizeValues(
    "Affected blocks",
    examples.map((example) => example.blockPath.join(" > "))
  );
}
function summarizeHelperGroups(examples) {
  return summarizeValues(
    "Helper groups",
    examples.flatMap((example) => example.setupSubjectNames ?? [])
  );
}

// src/scrap/test/duplication/recommendations.ts
function strengthenAssertionsRecommendation(zeroAssertionCount) {
  if (zeroAssertionCount === 0) {
    return [];
  }
  return [{
    confidence: "HIGH",
    kind: "STRENGTHEN_ASSERTIONS",
    message: `${zeroAssertionCount} example(s) have no assertions and should be tightened before structural cleanup.`
  }];
}
function tableDriveRecommendation(examples, tableDriveCandidateCount2) {
  if (tableDriveCandidateCount2 === 0) {
    return [];
  }
  return [{
    confidence: "HIGH",
    kind: "TABLE_DRIVE",
    message: `${tableDriveCandidateCount2} example(s) look like a coverage matrix that should be table-driven.${summarizeBlockPaths(coverageRelevantExamples(examples))}`
  }];
}
function extractSetupRecommendation(examples, repeatedSetupCount) {
  if (repeatedSetupCount === 0) {
    return [];
  }
  const strongestCluster = strongestSetupCluster(examples);
  return [{
    confidence: "MEDIUM",
    kind: "EXTRACT_SETUP",
    message: `${repeatedSetupCount} repeated setup cluster(s) look worth extracting into shared helpers or fixtures.${summarizeBlockPaths(strongestCluster)}${summarizeHelperGroups(strongestCluster)}`
  }];
}
function duplicationRecommendations(examples, counts) {
  return [
    ...strengthenAssertionsRecommendation(counts.zeroAssertionCount),
    ...tableDriveRecommendation(examples, counts.tableDriveCandidateCount),
    ...extractSetupRecommendation(examples, counts.recommendedExtractionCount)
  ];
}

// src/scrap/report/blocks/extractionCount.ts
function isExtractableSetup(example) {
  return example.duplicateSetupGroupSize > 1 && example.setupLineCount >= 2 && typeof example.setupFingerprint === "string";
}
function recommendedExtractionCount(examples) {
  return new Set(
    examples.filter(isExtractableSetup).map((example) => example.setupFingerprint)
  ).size;
}

// src/scrap/test/duplication/insights.ts
function fuzzyGroups(examples, selector) {
  return featureGroupSizes(examples.map(selector));
}
function resolvedGroups(examples, fuzzyGroupSizes, selector) {
  return fuzzyGroupSizes.some((groupSize) => groupSize > 0) ? fuzzyGroupSizes : countedFingerprintGroups(examples, selector);
}
function setupGroupSizes(examples) {
  const fuzzySetupGroups = fuzzyGroups(examples, (example) => example.setupFeatures);
  return examples.map(
    (example, index) => Math.max(fuzzySetupGroups[index] ?? 0, example.duplicateSetupGroupSize)
  );
}
function analyzeDuplicationInsights(examples) {
  const resolvedSetupGroupSizes = setupGroupSizes(examples);
  const assertionGroupSizes = resolvedGroups(
    examples,
    fuzzyGroups(examples, (example) => example.assertionFeatures),
    (example) => example.assertionFingerprint
  );
  const fixtureGroupSizes = resolvedGroups(
    examples,
    fuzzyGroups(examples, (example) => example.fixtureFeatures),
    (example) => example.fixtureFingerprint
  );
  const literalShapeGroupSizes = countedFingerprintGroups(
    examples,
    (example) => example.literalShapeFingerprint
  );
  const exampleGroupSizes = resolvedGroups(
    examples,
    fuzzyGroups(examples, (example) => example.exampleFeatures),
    (example) => example.exampleFingerprint
  );
  const zeroAssertionCount = examples.filter((example) => example.assertionCount === 0).length;
  const setupDuplicationScore = duplicateGroupCount(resolvedSetupGroupSizes);
  const assertionDuplicationScore = duplicateGroupCount(assertionGroupSizes);
  const fixtureDuplicationScore = duplicateGroupCount(fixtureGroupSizes);
  const literalDuplicationScore = duplicateGroupCount(literalShapeGroupSizes);
  const coverageMatrixCandidates = coverageMatrixCandidateCount(examples, {
    exampleGroupSizes,
    fixtureGroupSizes,
    literalShapeGroupSizes
  });
  const tableDriveCandidates = tableDriveCandidateCount(examples, {
    exampleGroupSizes,
    fixtureGroupSizes,
    literalShapeGroupSizes
  });
  const harmfulDuplicationScore = setupDuplicationScore + assertionDuplicationScore + fixtureDuplicationScore;
  const effectiveDuplicationScore = Math.max(0, harmfulDuplicationScore - coverageMatrixCandidates);
  const extractionPressureScore = Math.max(
    0,
    setupDuplicationScore + fixtureDuplicationScore - coverageMatrixCandidates
  );
  const repeatedSetupCount = recommendedExtractionCount(examples);
  const recommendations = duplicationRecommendations(examples, {
    coverageMatrixCandidateCount: coverageMatrixCandidates,
    recommendedExtractionCount: repeatedSetupCount,
    tableDriveCandidateCount: tableDriveCandidates,
    zeroAssertionCount
  });
  return {
    assertionDuplicationScore,
    coverageMatrixCandidateCount: coverageMatrixCandidates,
    effectiveDuplicationScore,
    extractionPressureScore,
    harmfulDuplicationScore,
    fixtureDuplicationScore,
    literalDuplicationScore,
    recommendations,
    recommendedExtractionCount: repeatedSetupCount,
    setupDuplicationScore
  };
}

// src/scrap/vitest/predicates.ts
function countExamples3(examples, predicate) {
  return examples.filter(predicate).length;
}
function hasAsyncWait(ex) {
  return (ex.asyncWaitCount ?? 0) > 0;
}
function hasConcurrency(ex) {
  return (ex.concurrencyCount ?? 0) > 0;
}
function hasEnvMutation(ex) {
  return (ex.envMutationCount ?? 0) > 0;
}
function hasFakeTimer(ex) {
  return (ex.fakeTimerCount ?? 0) > 0;
}
function hasModuleMock(ex) {
  return (ex.moduleMockCount ?? 0) > 0;
}

// src/scrap/vitest/rtlPredicates.ts
function hasRtlMutation(ex) {
  return (ex.rtlMutationCount ?? 0) > 0;
}
function isRtlQueryHeavy(ex) {
  return (ex.rtlRenderCount ?? 0) > 0 && (ex.rtlQueryCount ?? 0) >= 3 && (ex.rtlMutationCount ?? 0) === 0;
}
function hasRtlRender(ex) {
  return (ex.rtlRenderCount ?? 0) > 0;
}
function hasSnapshot(ex) {
  return (ex.snapshotCount ?? 0) > 0;
}
function hasTypeOnlyAssertion(ex) {
  return (ex.typeOnlyAssertionCount ?? 0) > 0;
}

// src/scrap/vitest/signalSummary.ts
function summarizeVitestSignals(examples) {
  return {
    asyncWaitExampleCount: countExamples3(examples, hasAsyncWait),
    concurrencyExampleCount: countExamples3(examples, hasConcurrency),
    envMutationExampleCount: countExamples3(examples, hasEnvMutation),
    fakeTimerExampleCount: countExamples3(examples, hasFakeTimer),
    moduleMockExampleCount: countExamples3(examples, hasModuleMock),
    rtlMutationExampleCount: countExamples3(examples, hasRtlMutation),
    rtlQueryHeavyExampleCount: countExamples3(examples, isRtlQueryHeavy),
    rtlRenderExampleCount: countExamples3(examples, hasRtlRender),
    snapshotExampleCount: countExamples3(examples, hasSnapshot),
    typeOnlyAssertionExampleCount: countExamples3(examples, hasTypeOnlyAssertion)
  };
}

// src/scrap/analysis/pipeline/metrics.ts
function analyzeScrapFile(sourceFile) {
  const examples = analyzeFileExamples(sourceFile);
  const validationIssues = validateScrapFile(sourceFile);
  const duplicationInsights = analyzeDuplicationInsights(examples);
  const cohesion = analyzeCohesionMetrics(examples);
  const blockSummaries = summarizeBlocks(examples);
  const counts = summarizeExampleCounts(examples);
  const vitestSignals = summarizeVitestSignals(examples);
  const exampleCount = examples.length;
  const meanScore = averageScore(examples);
  const maxExampleScore = maxScore(examples);
  const hotExamples = hotExampleCount(examples);
  const metric = {
    averageScore: roundScore(meanScore),
    averageAssertionSimilarity: roundScore(cohesion.averageAssertionSimilarity),
    averageExampleSimilarity: roundScore(cohesion.averageExampleSimilarity),
    averageFixtureSimilarity: roundScore(cohesion.averageFixtureSimilarity),
    averageSetupSimilarity: roundScore(cohesion.averageSetupSimilarity),
    averageSubjectOverlap: roundScore(cohesion.averageSubjectOverlap),
    assertionShapeDiversity: cohesion.assertionShapeDiversity,
    asyncWaitExampleCount: vitestSignals.asyncWaitExampleCount,
    branchingExampleCount: counts.branchingExampleCount,
    blockSummaries,
    coverageMatrixCandidateCount: duplicationInsights.coverageMatrixCandidateCount,
    concurrencyExampleCount: vitestSignals.concurrencyExampleCount,
    distinctSubjectCount: cohesion.distinctSubjectCount,
    duplicateSetupExampleCount: duplicateSetupExampleCount(counts.duplicateSetupGroupSizes),
    effectiveDuplicationScore: duplicationInsights.effectiveDuplicationScore,
    exampleCount,
    exampleShapeDiversity: cohesion.exampleShapeDiversity,
    extractionPressureScore: duplicationInsights.extractionPressureScore,
    filePath: sourceFile.fileName,
    fakeTimerExampleCount: vitestSignals.fakeTimerExampleCount,
    moduleMockExampleCount: vitestSignals.moduleMockExampleCount,
    harmfulDuplicationScore: duplicationInsights.harmfulDuplicationScore,
    fixtureDuplicationScore: duplicationInsights.fixtureDuplicationScore,
    helperHiddenExampleCount: counts.helperHiddenExampleCount,
    literalDuplicationScore: duplicationInsights.literalDuplicationScore,
    envMutationExampleCount: vitestSignals.envMutationExampleCount,
    lowAssertionExampleCount: counts.lowAssertionExampleCount,
    maxScore: maxExampleScore,
    recommendations: [
      ...duplicationInsights.recommendations,
      ...cohesionRecommendations(cohesion, exampleCount)
    ],
    recommendedExtractionCount: duplicationInsights.recommendedExtractionCount,
    remediationMode: remediationMode(exampleCount, meanScore, hotExamples, maxExampleScore),
    rtlMutationExampleCount: vitestSignals.rtlMutationExampleCount,
    rtlQueryHeavyExampleCount: vitestSignals.rtlQueryHeavyExampleCount,
    rtlRenderExampleCount: vitestSignals.rtlRenderExampleCount,
    snapshotExampleCount: vitestSignals.snapshotExampleCount,
    setupDuplicationScore: duplicationInsights.setupDuplicationScore,
    fixtureShapeDiversity: cohesion.fixtureShapeDiversity,
    setupShapeDiversity: cohesion.setupShapeDiversity,
    subjectRepetitionScore: cohesion.subjectRepetitionScore,
    tableDrivenExampleCount: counts.tableDrivenExampleCount,
    typeOnlyAssertionExampleCount: vitestSignals.typeOnlyAssertionExampleCount,
    tempResourceExampleCount: counts.tempResourceExampleCount,
    validationIssues,
    worstExamples: worstExamples(examples),
    zeroAssertionExampleCount: counts.zeroAssertionExampleCount
  };
  return {
    ...metric,
    aiActionability: aiActionability(metric)
  };
}

// src/scrap/analysis/pipeline/run.ts
function analyzeScrap(target) {
  return discoverTestFiles(target).map((filePath) => {
    const source = fs2.readFileSync(filePath, "utf-8");
    const sourceFile = ts25.createSourceFile(
      filePath,
      source,
      ts25.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts25.ScriptKind.TSX : ts25.ScriptKind.TS
    );
    return analyzeScrapFile(sourceFile);
  });
}

// src/scrap/report/verdict.ts
function includesNegative(values) {
  return values.some((value) => value < 0);
}
function includesPositive(values) {
  return values.some((value) => value > 0);
}
function verdictFromDeltas2(comparison) {
  const deltas = [
    comparison.averageScoreDelta,
    comparison.maxScoreDelta,
    comparison.extractionPressureDelta,
    comparison.harmfulDuplicationDelta,
    comparison.coverageMatrixDelta,
    comparison.helperHiddenDelta
  ];
  const hasImprovement = includesNegative(deltas);
  const hasRegression = includesPositive(deltas);
  if (hasImprovement && hasRegression) {
    return "mixed";
  }
  if (hasRegression) {
    return "worse";
  }
  if (hasImprovement) {
    return "improved";
  }
  return "unchanged";
}

// src/scrap/test/metric.ts
function roundedDelta2(current, previous) {
  return Math.round((current - previous) * 100) / 100;
}
function metricNumbers(metric) {
  return {
    averageScore: metric.averageScore,
    coverageMatrixCandidateCount: metric.coverageMatrixCandidateCount ?? 0,
    extractionPressureScore: metric.extractionPressureScore ?? 0,
    harmfulDuplicationScore: metric.harmfulDuplicationScore ?? 0,
    helperHiddenExampleCount: metric.helperHiddenExampleCount,
    maxScore: metric.maxScore
  };
}
function baselineNumbers(metric) {
  return {
    averageScore: metric.averageScore ?? 0,
    coverageMatrixCandidateCount: metric.coverageMatrixCandidateCount ?? 0,
    extractionPressureScore: metric.extractionPressureScore ?? 0,
    harmfulDuplicationScore: metric.harmfulDuplicationScore ?? 0,
    helperHiddenExampleCount: metric.helperHiddenExampleCount ?? 0,
    maxScore: metric.maxScore ?? 0
  };
}
function deltaSnapshot(current, previous) {
  return {
    averageScoreDelta: roundedDelta2(current.averageScore, previous.averageScore),
    coverageMatrixDelta: roundedDelta2(
      current.coverageMatrixCandidateCount,
      previous.coverageMatrixCandidateCount
    ),
    extractionPressureDelta: roundedDelta2(
      current.extractionPressureScore,
      previous.extractionPressureScore
    ),
    harmfulDuplicationDelta: roundedDelta2(
      current.harmfulDuplicationScore,
      previous.harmfulDuplicationScore
    ),
    helperHiddenDelta: roundedDelta2(
      current.helperHiddenExampleCount,
      previous.helperHiddenExampleCount
    ),
    maxScoreDelta: roundedDelta2(current.maxScore, previous.maxScore)
  };
}
function comparisonForMetric(current, previous) {
  if (!previous) {
    return void 0;
  }
  const comparison = deltaSnapshot(metricNumbers(current), baselineNumbers(previous));
  return {
    ...comparison,
    verdict: verdictFromDeltas2(comparison)
  };
}

// src/scrap/test/compare.ts
function applyBaselineComparison(metrics, baselinePath) {
  const previousByPath = baselineMetricsByPath2(readBaselineMetrics(baselinePath));
  return metrics.map((metric) => ({
    ...metric,
    comparison: comparisonForMetric(metric, previousByPath.get(metric.filePath))
  }));
}

// src/scrap/policy/violations.ts
function hasSplitViolation(metric) {
  return metric.remediationMode === "SPLIT";
}
function hasReviewFirstViolation(metric) {
  return metric.aiActionability === "REVIEW_FIRST";
}
function hasPolicyViolations(metrics, policy) {
  switch (policy) {
    case "split":
      return metrics.some(hasSplitViolation);
    case "review":
      return metrics.some(hasReviewFirstViolation);
    case "strict":
      return metrics.some(hasSplitViolation) || metrics.some(hasReviewFirstViolation);
    case "advisory":
    default:
      return false;
  }
}

// src/scrap/policy/failureMessage.ts
function policyFailureMessage(policy) {
  if (policy === "split") {
    return "SCRAP split policy failed: split files are present.";
  }
  if (policy === "review") {
    return "SCRAP review policy failed: review-first files are present.";
  }
  if (policy === "strict") {
    return "SCRAP strict mode failed: split or review-first files are present.";
  }
  return void 0;
}

// src/scrap/policy/resolve.ts
function resolveScrapPolicy(args2) {
  const preset = flagValue(args2, "--policy");
  if (preset === "strict" || preset === "advisory" || preset === "review" || preset === "split") {
    return preset;
  }
  if (preset !== void 0) {
    throw new Error(`Unknown SCRAP policy preset: ${preset}`);
  }
  return args2.includes("--strict") ? "strict" : "advisory";
}

// src/scrap/report/blocks/format.ts
function formatBlockPath(path4) {
  return path4.join(" > ");
}
function interestingBlocks(metric) {
  return metric.blockSummaries.filter((block) => block.remediationMode !== "STABLE").slice(0, 5);
}
function hotBlockLines(metric) {
  const hotBlocks = interestingBlocks(metric);
  if (hotBlocks.length === 0) {
    return [];
  }
  return [
    "  hot blocks:",
    ...hotBlocks.map(
      (block) => `    - ${formatBlockPath(block.path)} mode=${block.remediationMode} examples=${block.exampleCount} avg/max=${block.averageScore} / ${block.maxScore} hot=${block.hotExampleCount} dupes=${block.duplicateSetupExampleCount} helpers=${block.helperHiddenExampleCount} extract=${block.recommendedExtractionCount ?? 0}`
    )
  ];
}

// src/scrap/report/blocks/comparison.ts
function comparisonLines(metric) {
  if (!metric.comparison) {
    return [];
  }
  return [
    `  compare: ${metric.comparison.verdict} avg\u0394=${metric.comparison.averageScoreDelta} max\u0394=${metric.comparison.maxScoreDelta} extract\u0394=${metric.comparison.extractionPressureDelta} matrix\u0394=${metric.comparison.coverageMatrixDelta} dup\u0394=${metric.comparison.harmfulDuplicationDelta} helper\u0394=${metric.comparison.helperHiddenDelta}`
  ];
}

// src/scrap/report/blocks/examples.ts
function worstExampleLines(metric) {
  if (metric.worstExamples.length === 0) {
    return [];
  }
  return [
    "  worst examples:",
    ...metric.worstExamples.map(
      (example) => `    - ${example.name} (L${example.startLine}-L${example.endLine}) score=${example.score} assertions=${example.assertionCount} branches=${example.branchCount} mocks=${example.mockCount} setup=${example.setupLineCount} dupes=${example.duplicateSetupGroupSize} helpers=${example.helperCallCount} hidden=${example.helperHiddenLineCount}`
    )
  ];
}
function verboseExampleLines(metric) {
  return [
    "  verbose examples:",
    ...metric.worstExamples.map(
      (example) => `    - ${example.name} tableDriven=${example.tableDriven} setupDepth=${example.setupDepth} tempResources=${example.tempResourceCount} snapshots=${example.snapshotCount ?? 0} waits=${example.asyncWaitCount ?? 0} fakeTimers=${example.fakeTimerCount ?? 0} moduleMocks=${example.moduleMockCount ?? 0} envMutations=${example.envMutationCount ?? 0} concurrent=${example.concurrencyCount ?? 0} typeOnly=${example.typeOnlyAssertionCount ?? 0}`
    )
  ];
}

// src/scrap/report/blocks/recommendations.ts
function recommendationLines(metric) {
  if ((metric.recommendations?.length ?? 0) === 0) {
    return [];
  }
  return [
    "  recommendations:",
    ...(metric.recommendations ?? []).map(
      (recommendation) => `    - ${recommendation.kind} confidence=${recommendation.confidence} ${recommendation.message}`
    )
  ];
}

// src/scrap/report/summary.ts
import { relative as relative8 } from "path";
function summaryCount(value) {
  return value ?? 0;
}
function coreSummaryLines(metric) {
  return [
    `  mode: ${metric.remediationMode}`,
    `  examples: ${metric.exampleCount}`,
    `  avg/max: ${metric.averageScore} / ${metric.maxScore}`,
    `  actionability: ${metric.aiActionability ?? "LEAVE_ALONE"}`
  ];
}
function duplicationSummaryLines(metric) {
  return [
    `  zero-assertion: ${metric.zeroAssertionExampleCount}`,
    `  low-assertion: ${metric.lowAssertionExampleCount}`,
    `  branching: ${metric.branchingExampleCount}`,
    `  duplicate-setup: ${metric.duplicateSetupExampleCount}`,
    `  fixture-duplication: ${metric.fixtureDuplicationScore ?? 0}`,
    `  literal-duplication: ${metric.literalDuplicationScore ?? 0}`,
    `  helper-hidden: ${metric.helperHiddenExampleCount}`,
    `  coverage-matrix: ${metric.coverageMatrixCandidateCount ?? 0}`,
    `  extraction-pressure: ${metric.extractionPressureScore ?? 0}`
  ];
}
function cohesionSummaryLines(metric) {
  return [
    `  subjects: ${metric.distinctSubjectCount ?? 0}`,
    `  subject-overlap: ${metric.averageSubjectOverlap ?? 0}`,
    `  shape-diversity: ${metric.exampleShapeDiversity ?? 0}`,
    `  fixture-diversity: ${metric.fixtureShapeDiversity ?? 0}`
  ];
}
function vitestSignalCounts(metric) {
  const snapshots = summaryCount(metric.snapshotExampleCount);
  const waits = summaryCount(metric.asyncWaitExampleCount);
  const fakeTimers = summaryCount(metric.fakeTimerExampleCount);
  const moduleMocks = summaryCount(metric.moduleMockExampleCount);
  const envMutations = summaryCount(metric.envMutationExampleCount);
  const concurrent = summaryCount(metric.concurrencyExampleCount);
  const typeOnly = summaryCount(metric.typeOnlyAssertionExampleCount);
  const rtlRender = summaryCount(metric.rtlRenderExampleCount);
  const rtlQueryHeavy = summaryCount(metric.rtlQueryHeavyExampleCount);
  const rtlMutations = summaryCount(metric.rtlMutationExampleCount);
  return `  vitest-signals: snapshots=${snapshots} waits=${waits} fake-timers=${fakeTimers} module-mocks=${moduleMocks} env/global=${envMutations} concurrent=${concurrent} type-only=${typeOnly} rtl-renders=${rtlRender} rtl-query-heavy=${rtlQueryHeavy} rtl-mutations=${rtlMutations}`;
}
function vitestSummaryLines(metric) {
  return [
    vitestSignalCounts(metric),
    `  temp-resources: ${summaryCount(metric.tempResourceExampleCount)}`,
    `  validation-issues: ${metric.validationIssues?.length ?? 0}`
  ];
}
function summaryLines4(metric, repoRoot) {
  return [
    `
${relative8(repoRoot, metric.filePath)}`,
    ...coreSummaryLines(metric),
    ...duplicationSummaryLines(metric),
    ...cohesionSummaryLines(metric),
    ...vitestSummaryLines(metric)
  ];
}

// src/scrap/report/blocks/validation.ts
function validationLines(metric) {
  if ((metric.validationIssues?.length ?? 0) === 0) {
    return [];
  }
  return [
    "  validation:",
    ...(metric.validationIssues ?? []).map(
      (issue2) => `    - [${issue2.kind}] L${issue2.line} ${issue2.message}`
    )
  ];
}

// src/scrap/report/format.ts
function logLines4(lines) {
  for (const line of lines) {
    console.log(line);
  }
}
function reportScrap(metrics, repoRoot, options = {}) {
  if (metrics.length === 0) {
    console.log("\nNo test files found for SCRAP analysis.\n");
    return;
  }
  for (const metric of metrics) {
    logLines4(summaryLines4(metric, repoRoot));
    logLines4(comparisonLines(metric));
    logLines4(validationLines(metric));
    logLines4(recommendationLines(metric));
    logLines4(hotBlockLines(metric));
    logLines4(worstExampleLines(metric));
    if (options.verbose) {
      logLines4(verboseExampleLines(metric));
    }
  }
}

// src/scrap/baseline.ts
import { mkdirSync as mkdirSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join17 } from "path";
function baselinePathFor2(targetRelativePath) {
  const reportKey = sanitizeReportKey(targetRelativePath === "." ? "repo" : targetRelativePath);
  return resolveReportPath(REPO_ROOT, "scrap", `${reportKey}.json`);
}
function baseline(targetRelativePath, metrics) {
  const baselinePath = baselinePathFor2(targetRelativePath);
  mkdirSync3(join17(baselinePath, ".."), { recursive: true });
  writeFileSync3(baselinePath, JSON.stringify(metrics, null, 2));
}

// src/scrap/command.ts
var DEFAULT_DEPENDENCIES5 = {
  analyzeScrap,
  reportScrap,
  resolveQualityTarget,
  setExitCode: (code) => {
    process.exitCode = code;
  }
};
function runScrapCli(rawArgs, dependencies = DEFAULT_DEPENDENCIES5) {
  const args2 = cleanCliArgs(rawArgs);
  const target = dependencies.resolveQualityTarget(REPO_ROOT, parseTargetArg(args2, ["--compare", "--policy"]));
  const comparePath = flagValue(args2, "--compare");
  const verbose = args2.includes("--verbose");
  const writeBaseline = args2.includes("--write-baseline");
  const policy = resolveScrapPolicy(args2);
  let metrics = dependencies.analyzeScrap(target);
  if (comparePath) {
    metrics = applyBaselineComparison(metrics, comparePath);
  }
  if (writeBaseline) {
    baseline(target.relativePath, metrics);
  }
  const policyFailure = hasPolicyViolations(metrics, policy);
  const failureMessage = policyFailureMessage(policy);
  if (args2.includes("--json")) {
    console.log(JSON.stringify(metrics, null, 2));
    if (policyFailure) {
      dependencies.setExitCode(1);
    }
    return;
  }
  dependencies.reportScrap(metrics, REPO_ROOT, { verbose });
  if (policyFailure && failureMessage) {
    console.error(failureMessage);
    dependencies.setExitCode(1);
  }
}

// src/cli/main.ts
var COMMANDS = {
  acceptance: runAcceptanceCli,
  boundaries: runBoundariesCli,
  crap: runCrapCli,
  init: runInitCli,
  mutate: runMutationCli,
  organize: runOrganizeCli,
  reachability: runReachabilityCli,
  scrap: runScrapCli
};
function printHelp() {
  console.log(`quality-tools <command> [target] [flags]

Commands:
  init          Create a starter quality.config.json
  acceptance    Compile human-authored acceptance specs into executable tests
  organize     Check folder structure, naming, and cohesion
  boundaries   Check package/layer boundaries
  reachability Check dead surfaces and dead ends
  crap         Check complexity and coverage risk
  mutate       Run mutation testing through the configured runner
  scrap        Check test structure and refactor pressure
`);
}
var [command, ...args] = cleanCliArgs(process.argv.slice(2));
if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}
var run = COMMANDS[command];
if (!run) {
  console.error(`Unknown quality-tools command: ${command}`);
  printHelp();
  process.exit(1);
}
try {
  await run(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
