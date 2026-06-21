import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { analyzeAcceptanceIrDryness } from './dryChecker';
import type { AcceptanceIrDocument } from './ir';
import { toAcceptanceIr } from './ir';
import { parseAcceptanceFeature } from './parser';
import {
  generatePlaywrightAcceptanceRuntime,
  generatePlaywrightAcceptanceSpec
} from './playwright/generator';
import { cleanCliArgs } from '../shared/cliArgs';

export interface AcceptanceCliOptions {
  cwd?: string;
}

interface CompileOptions {
  specPatterns: string[];
  stepsPath: string;
  generatedDir: string;
  irDir: string;
  dryDir?: string;
  includeExact: boolean;
  includeSimilar: boolean;
}

interface GenerateOptions {
  irPath: string;
  outPath: string;
  stepsPath: string;
}

interface DryCheckOptions {
  irPath: string;
  reportPath: string;
  includeExact: boolean;
  includeSimilar: boolean;
}

type AcceptanceCommandRunner = (args: string[], cwd: string) => void | Promise<void>;

const ACCEPTANCE_COMMANDS = new Map<string, AcceptanceCommandRunner>([
  ['parse', parseCommand],
  ['dry-check', dryCheckCommand],
  ['generate', generateCommand],
  ['compile', compileCommand]
]);

const COMPILE_VALUE_FLAGS = [
  '--steps',
  '--ir',
  '--dry',
  '--spec',
  '--out-dir',
  '--ir-dir',
  '--dry-report-dir'
];

export async function runAcceptanceCli(
  rawArgs: string[],
  options: AcceptanceCliOptions = {}
): Promise<void> {
  const args = cleanCliArgs(rawArgs);
  const [command, ...commandArgs] = args;
  const cwd = options.cwd ?? process.cwd();

  if (isHelpCommand(command)) {
    console.log(acceptanceUsage());
    return;
  }

  await requireAcceptanceCommand(command)(commandArgs, cwd);
}

function acceptanceUsage(): string {
  return [
    'Usage:',
    '  quality-tools acceptance parse <feature-file> <json-output>',
    '  quality-tools acceptance dry-check [--include-exact] [--include-similar] <json-ir> <report-output>',
    '  quality-tools acceptance generate <json-ir> <generated-test-output> --steps <path>',
    '  quality-tools acceptance compile <spec-glob> <generated-output-dir> --steps <path> [--ir <dir>] [--dry <dir>]'
  ].join('\n');
}

function parseCommand(args: string[], cwd: string): void {
  const [featurePath, jsonOutputPath, ...extraArgs] = args;
  if (!featurePath || !jsonOutputPath || extraArgs.length > 0) {
    throw new Error('Usage: quality-tools acceptance parse <feature-file> <json-output>');
  }

  const ir = parseIrFile(cwd, featurePath);
  writeJsonFile(path.resolve(cwd, jsonOutputPath), ir);
}

function dryCheckCommand(args: string[], cwd: string): void {
  const options = parseDryCheckOptions(args);
  const report = analyzeAcceptanceIrDryness(readIrFile(cwd, options.irPath), {
    includeExact: options.includeExact,
    includeSimilar: options.includeSimilar
  });
  writeJsonFile(path.resolve(cwd, options.reportPath), report);
}

function generateCommand(args: string[], cwd: string): void {
  const options = parseGenerateOptions(args);
  writeGeneratedPlaywrightSpec(cwd, options.irPath, options.outPath, options.stepsPath);
}

async function compileCommand(args: string[], cwd: string): Promise<void> {
  const options = parseCompileOptions(args);
  const specFiles = await findSpecFiles(cwd, options.specPatterns);

  if (specFiles.length === 0) {
    throw new Error(`No acceptance specs matched: ${options.specPatterns.join(', ')}`);
  }

  const generatedDir = path.resolve(cwd, options.generatedDir);
  writePlaywrightRuntime(generatedDir);

  specFiles.forEach((specFile) => {
    const ir = parseIrFile(cwd, specFile);
    const slug = sourcePathSlug(ir.source_path);
    const irPath = path.join(path.resolve(cwd, options.irDir), `${slug}.json`);
    const generatedPath = path.join(generatedDir, `${slug}.spec.ts`);

    writeJsonFile(irPath, ir);

    if (options.dryDir) {
      writeJsonFile(path.join(path.resolve(cwd, options.dryDir), `${slug}.json`), analyzeAcceptanceIrDryness(ir, {
        includeExact: options.includeExact,
        includeSimilar: options.includeSimilar
      }));
    }

    writeGeneratedPlaywrightSpec(cwd, irPath, generatedPath, options.stepsPath);
  });
}

function parseDryCheckOptions(args: string[]): DryCheckOptions {
  const positional = args.filter((arg) => !arg.startsWith('--'));

  if (positional.length !== 2) {
    throw new Error('Usage: quality-tools acceptance dry-check [--include-exact] [--include-similar] <json-ir> <report-output>');
  }

  return {
    irPath: positional[0] ?? '',
    reportPath: positional[1] ?? '',
    includeExact: args.includes('--include-exact'),
    includeSimilar: args.includes('--include-similar')
  };
}

function parseGenerateOptions(args: string[]): GenerateOptions {
  const positional = args.filter((arg, index) => arg !== '--steps' && args[index - 1] !== '--steps' && !arg.startsWith('--'));

  if (positional.length !== 2) {
    throw new Error('Usage: quality-tools acceptance generate <json-ir> <generated-test-output> --steps <path>');
  }

  return {
    irPath: positional[0] ?? '',
    outPath: positional[1] ?? '',
    stepsPath: requireFlagValue(args, '--steps')
  };
}

function parseCompileOptions(args: string[]): CompileOptions {
  const positional = collectPositionalArgs(args, COMPILE_VALUE_FLAGS);
  const specPatterns = resolveCompileSpecPatterns(args, positional);
  const generatedDir = requireCompileGeneratedDir(specPatterns, resolveGeneratedDir(args, positional));

  return {
    specPatterns,
    stepsPath: requireFlagValue(args, '--steps'),
    generatedDir,
    irDir: resolveIrDir(args, generatedDir),
    dryDir: resolveDryDir(args),
    includeExact: args.includes('--include-exact'),
    includeSimilar: args.includes('--include-similar')
  };
}

function isHelpCommand(command: string | undefined): boolean {
  return !command || command === '--help' || command === '-h';
}

function requireAcceptanceCommand(command: string | undefined): AcceptanceCommandRunner {
  const runner = command ? ACCEPTANCE_COMMANDS.get(command) : undefined;
  if (!runner) {
    throw new Error(acceptanceUsage());
  }

  return runner;
}

function collectPositionalArgs(args: string[], valueFlags: string[]): string[] {
  return args.filter((arg, index) =>
    !arg.startsWith('--') && !isFlagValue(args, index, valueFlags)
  );
}

function resolveCompileSpecPatterns(args: string[], positional: string[]): string[] {
  const specFlags = collectFlagValues(args, '--spec');
  return specFlags.length > 0 ? specFlags : positional.slice(0, 1);
}

function resolveGeneratedDir(args: string[], positional: string[]): string | undefined {
  return collectFlagValues(args, '--out-dir').at(0) ?? positional[1];
}

function requireCompileGeneratedDir(
  specPatterns: string[],
  generatedDir: string | undefined
): string {
  if (specPatterns.length === 0 || !generatedDir) {
    throw new Error('Usage: quality-tools acceptance compile <spec-glob> <generated-output-dir> --steps <path> [--ir <dir>] [--dry <dir>]');
  }

  return generatedDir;
}

function resolveIrDir(args: string[], generatedDir: string): string {
  return collectFlagValues(args, '--ir').at(0)
    ?? collectFlagValues(args, '--ir-dir').at(0)
    ?? path.join(generatedDir, '..', 'generated-ir');
}

function resolveDryDir(args: string[]): string | undefined {
  return collectFlagValues(args, '--dry').at(0)
    ?? collectFlagValues(args, '--dry-report-dir').at(0);
}

function parseIrFile(cwd: string, featurePath: string): AcceptanceIrDocument {
  const resolvedPath = path.resolve(cwd, featurePath);
  const source = fs.readFileSync(resolvedPath, 'utf8');
  return toAcceptanceIr(parseAcceptanceFeature(source, toPosixPath(path.relative(cwd, resolvedPath))));
}

function readIrFile(cwd: string, irPath: string): AcceptanceIrDocument {
  return JSON.parse(fs.readFileSync(path.resolve(cwd, irPath), 'utf8')) as AcceptanceIrDocument;
}

function writeGeneratedPlaywrightSpec(cwd: string, irPath: string, outPath: string, stepsPath: string): void {
  const resolvedOutPath = path.resolve(cwd, outPath);
  const generatedDir = path.dirname(resolvedOutPath);
  writePlaywrightRuntime(generatedDir);
  writeFile(resolvedOutPath, generatePlaywrightAcceptanceSpec({
    irImportPath: toPosixPath(path.relative(cwd, path.resolve(cwd, irPath))),
    runtimeImportPath: createExtensionlessImportPath(resolvedOutPath, path.join(generatedDir, 'runtime.ts')),
    stepsImportPath: createExtensionlessImportPath(resolvedOutPath, path.resolve(cwd, stepsPath))
  }));
}

function writePlaywrightRuntime(generatedDir: string): void {
  writeFile(path.join(generatedDir, 'runtime.ts'), generatePlaywrightAcceptanceRuntime());
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

async function findSpecFiles(cwd: string, patterns: string[]): Promise<string[]> {
  const files = await Promise.all(
    patterns.map((pattern) => glob(pattern, { absolute: true, cwd, nodir: true }))
  );

  return [...new Set(files.flat())].sort((left, right) => left.localeCompare(right));
}

function createExtensionlessImportPath(outPath: string, targetPath: string): string {
  const relativePath = toPosixPath(path.relative(path.dirname(outPath), targetPath));
  const extension = path.extname(relativePath);
  const extensionlessPath = extension ? relativePath.slice(0, -extension.length) : relativePath;

  if (extensionlessPath.startsWith('.')) {
    return extensionlessPath;
  }

  return `./${extensionlessPath}`;
}

function collectFlagValues(args: string[], flag: string): string[] {
  const values: string[] = [];

  args.forEach((arg, index) => {
    if (arg === flag) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${flag}`);
      }
      values.push(value);
    }
  });

  return values;
}

function requireFlagValue(args: string[], flag: string): string {
  const value = collectFlagValues(args, flag).at(0);
  if (!value) {
    throw new Error(`Missing required ${flag} <path>`);
  }

  return value;
}

function isFlagValue(args: string[], index: number, flags: string[]): boolean {
  return flags.includes(args[index - 1] ?? '');
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

function sourcePathSlug(sourcePath: string): string {
  return sourcePath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
