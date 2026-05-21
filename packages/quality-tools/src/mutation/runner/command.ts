import { cleanCliArgs, flagValue, parseBareTargetArg } from '../../shared/cliArgs';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { resolveQualityTarget, type QualityTarget } from '../../shared/resolve/target';
import { runMutation, type MutationRunOptions } from './run';

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

export async function runMutationCli(
  rawArgs: string[],
  dependencies: MutationCliDependencies = createDefaultMutationCliDependencies()
): Promise<void> {
  const args = cleanCliArgs(rawArgs);
  const targets = resolveCliTargets(
    parseBareTargetArg(args),
    flagValue(args, '--mutate'),
    dependencies,
  );
  const options = {
    force: args.includes('--force')
  };

  for (const target of targets) {
    await dependencies.runMutation(target, options);
  }
}
