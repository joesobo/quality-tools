import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { parseAcceptanceMarkdown } from './parser';
import { generatePlaywrightAcceptanceSpec } from './playwright/generator';
import { cleanCliArgs } from '../shared/cliArgs';

export interface AcceptanceCliOptions {
  cwd?: string;
}

interface CompileOptions {
  specPatterns: string[];
  stepsPath: string;
  outPath: string;
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

  const documents = specFiles.map((specFile) => {
    const source = fs.readFileSync(specFile, 'utf8');
    return parseAcceptanceMarkdown(source, toPosixPath(path.relative(cwd, specFile)));
  });
  const outPath = path.resolve(cwd, options.outPath);
  const stepsImportPath = createStepsImportPath(outPath, path.resolve(cwd, options.stepsPath));
  const generated = generatePlaywrightAcceptanceSpec(documents, { stepsImportPath });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, generated);
}

function parseCompileOptions(args: string[]): CompileOptions {
  const specPatterns = collectFlagValues(args, '--spec');
  const stepsPath = requireFlagValue(args, '--steps');
  const outPath = requireFlagValue(args, '--out');

  if (specPatterns.length === 0) {
    throw new Error('Missing required --spec <glob>');
  }

  return {
    specPatterns,
    stepsPath,
    outPath
  };
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
