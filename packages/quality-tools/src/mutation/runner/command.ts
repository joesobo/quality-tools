import { cleanCliArgs, flagValue } from '../../shared/cliArgs';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { resolveQualityTarget, type QualityTarget } from '../../shared/resolve/target';
import { runMutation, type MutationRunOptions } from './run';

const VALUE_FLAGS = new Set([
  '--mutate',
  '--mutate-glob',
  '--mutate-globs-json',
  '--test-include',
  '--test-includes-json',
]);

export interface MutationCliDependencies {
  resolveQualityTarget: typeof resolveQualityTarget;
  runMutation: (target: QualityTarget, options?: MutationRunOptions) => Promise<void>;
}

export function createDefaultMutationCliDependencies(): MutationCliDependencies {
  return {
    resolveQualityTarget,
    runMutation
  };
}

function resolveCliTargets(
  input: string | undefined,
  mutateInput: string | undefined,
  dependencies: MutationCliDependencies
): QualityTarget[] {
  if (mutateInput) {
    return [dependencies.resolveQualityTarget(REPO_ROOT, mutateInput)];
  }

  if (input) {
    return [dependencies.resolveQualityTarget(REPO_ROOT, input)];
  }

  throw new Error(
    'Mutation requires an explicit package, directory, file, or repo target. ' +
    'Example: `quality-tools mutate .` or `quality-tools mutate packages/foo/src/bar.ts`.'
  );
}

function parseBareMutationTargetArg(args: readonly string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (VALUE_FLAGS.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      return arg;
    }
  }

  return undefined;
}

function collectFlagValues(args: readonly string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === name && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1));
    }
  }

  return values;
}

function parseJsonStringArray(value: string | undefined, flagName: string): string[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${flagName} must be a JSON array of strings.`);
  }

  return parsed;
}

function mutationRunOptions(args: string[]): MutationRunOptions {
  const mutateGlobs = [
    ...collectFlagValues(args, '--mutate-glob'),
    ...parseJsonStringArray(flagValue(args, '--mutate-globs-json'), '--mutate-globs-json'),
  ];
  const testIncludes = [
    ...collectFlagValues(args, '--test-include'),
    ...parseJsonStringArray(flagValue(args, '--test-includes-json'), '--test-includes-json'),
  ];

  return {
    force: args.includes('--force'),
    ...(mutateGlobs.length > 0 ? { mutateGlobs } : {}),
    ...(testIncludes.length > 0 ? { testIncludes } : {})
  };
}

export async function runMutationCli(
  rawArgs: string[],
  dependencies: MutationCliDependencies = createDefaultMutationCliDependencies()
): Promise<void> {
  const args = cleanCliArgs(rawArgs);
  const targets = resolveCliTargets(
    parseBareMutationTargetArg(args),
    flagValue(args, '--mutate'),
    dependencies,
  );
  const options = mutationRunOptions(args);

  for (const target of targets) {
    await dependencies.runMutation(target, options);
  }
}
