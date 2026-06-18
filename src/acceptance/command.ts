import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { analyzeAcceptanceIrDryness } from './dryChecker';
import { toAcceptanceIr } from './ir';
import type { AcceptanceDocument } from './model';
import { parseAcceptanceMarkdown } from './parser';
import { generatePlaywrightAcceptanceSpec } from './playwright/generator';
import { cleanCliArgs } from '../shared/cliArgs';

export interface AcceptanceCliOptions {
  cwd?: string;
}

interface CompileOptions {
  specPatterns: string[];
  stepsPath: string;
  outPath?: string;
  outDir?: string;
  irDir?: string;
  dryReportDir?: string;
}

export async function runAcceptanceCli(
  rawArgs: string[],
  options: AcceptanceCliOptions = {}
): Promise<void> {
  const args = cleanCliArgs(rawArgs);
  const [command, ...commandArgs] = args;

  if (command !== 'compile') {
    throw new Error('Usage: quality-tools acceptance compile --spec <glob> --steps <path> --out <path>');
  }

  await compileAcceptance(commandArgs, options.cwd ?? process.cwd());
}

async function compileAcceptance(args: string[], cwd: string): Promise<void> {
  const options = parseCompileOptions(args);
  const specFiles = await findSpecFiles(cwd, options.specPatterns);

  if (specFiles.length === 0) {
    throw new Error(`No acceptance specs matched: ${options.specPatterns.join(', ')}`);
  }

  const documents = specFiles.map((specFile) => parseSpecFile(cwd, specFile));
  writeIrFiles(cwd, options.irDir, documents);
  writeDryReports(cwd, options.dryReportDir, documents);

  if (options.outDir) {
    writeSplitPlaywrightSpecs(cwd, options, documents);
    return;
  }

  if (!options.outPath) {
    throw new Error('Missing required --out <path> or --out-dir <path>');
  }

  const outPath = path.resolve(cwd, options.outPath);
  const stepsImportPath = createStepsImportPath(outPath, path.resolve(cwd, options.stepsPath));
  writeFile(outPath, generatePlaywrightAcceptanceSpec(documents, { stepsImportPath }));
}

function parseCompileOptions(args: string[]): CompileOptions {
  const specPatterns = collectFlagValues(args, '--spec');
  const stepsPath = requireFlagValue(args, '--steps');
  const outPath = collectFlagValues(args, '--out').at(0);
  const outDir = collectFlagValues(args, '--out-dir').at(0);
  const irDir = collectFlagValues(args, '--ir-dir').at(0);
  const dryReportDir = collectFlagValues(args, '--dry-report-dir').at(0);

  if (specPatterns.length === 0) {
    throw new Error('Missing required --spec <glob>');
  }

  if (outPath && outDir) {
    throw new Error('Use either --out <path> or --out-dir <path>, not both');
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

function parseSpecFile(cwd: string, specFile: string): AcceptanceDocument {
  const source = fs.readFileSync(specFile, 'utf8');
  return parseAcceptanceMarkdown(source, toPosixPath(path.relative(cwd, specFile)));
}

function writeIrFiles(cwd: string, irDir: string | undefined, documents: AcceptanceDocument[]): void {
  if (!irDir) {
    return;
  }

  const resolvedDir = path.resolve(cwd, irDir);
  documents.forEach((document) => {
    writeJsonFile(path.join(resolvedDir, `${sourcePathSlug(document.sourcePath)}.json`), toAcceptanceIr(document));
  });
}

function writeDryReports(cwd: string, dryReportDir: string | undefined, documents: AcceptanceDocument[]): void {
  if (!dryReportDir) {
    return;
  }

  const resolvedDir = path.resolve(cwd, dryReportDir);
  documents.forEach((document) => {
    writeJsonFile(path.join(resolvedDir, `${sourcePathSlug(document.sourcePath)}.json`), analyzeAcceptanceIrDryness(document));
  });
}

function writeSplitPlaywrightSpecs(cwd: string, options: CompileOptions, documents: AcceptanceDocument[]): void {
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

  return files.flat().sort((left, right) => left.localeCompare(right));
}

function createStepsImportPath(outPath: string, stepsPath: string): string {
  const relativePath = toPosixPath(path.relative(path.dirname(outPath), stepsPath));
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

function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

function sourcePathSlug(sourcePath: string): string {
  return sourcePath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
