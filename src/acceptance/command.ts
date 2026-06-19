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

export async function runAcceptanceCli(
  rawArgs: string[],
  options: AcceptanceCliOptions = {}
): Promise<void> {
  const args = cleanCliArgs(rawArgs);
  const [command, ...commandArgs] = args;
  const cwd = options.cwd ?? process.cwd();

  if (!command || command === '--help' || command === '-h') {
    console.log(acceptanceUsage());
    return;
  }

  if (command === 'parse') {
    parseCommand(commandArgs, cwd);
    return;
  }

  if (command === 'dry-check') {
    dryCheckCommand(commandArgs, cwd);
    return;
  }

  if (command === 'generate') {
    generateCommand(commandArgs, cwd);
    return;
  }

  if (command === 'compile') {
    await compileCommand(commandArgs, cwd);
    return;
  }

  throw new Error(acceptanceUsage());
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
  const positional = args.filter((arg, index) =>
    !arg.startsWith('--') &&
    !isFlagValue(args, index, ['--steps', '--ir', '--dry', '--spec', '--out-dir', '--ir-dir', '--dry-report-dir'])
  );
  const legacySpecPatterns = collectFlagValues(args, '--spec');
  const specPatterns = legacySpecPatterns.length > 0 ? legacySpecPatterns : positional.slice(0, 1);
  const generatedDir = collectFlagValues(args, '--out-dir').at(0) ?? positional[1];
  const irDir = collectFlagValues(args, '--ir').at(0)
    ?? collectFlagValues(args, '--ir-dir').at(0)
    ?? path.join(generatedDir ?? '', '..', 'generated-ir');
  const dryDir = collectFlagValues(args, '--dry').at(0)
    ?? collectFlagValues(args, '--dry-report-dir').at(0);

  if (specPatterns.length === 0 || !generatedDir) {
    throw new Error('Usage: quality-tools acceptance compile <spec-glob> <generated-output-dir> --steps <path> [--ir <dir>] [--dry <dir>]');
  }

  return {
    specPatterns,
    stepsPath: requireFlagValue(args, '--steps'),
    generatedDir,
    irDir,
    dryDir,
    includeExact: args.includes('--include-exact'),
    includeSimilar: args.includes('--include-similar')
  };
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
