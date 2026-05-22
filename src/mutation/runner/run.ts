import { spawn } from 'child_process';
import { type QualityTarget } from '../../shared/resolve/target';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { copySharedMutationReports } from '../reporting/reportArtifacts';
import { reportMutationSiteViolations } from '../reporting/check';
import { buildMutationArgs, buildMutationArgsForTest, type MutationRunOptions } from './args';
import { strykerBinPath } from './strykerBinary';
import { buildMutationEnv } from './environment';

const MUTATION_PROGRESS_INTERVAL_MS = 60_000;

function formatElapsedDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function runStryker(args: string[], env: NodeJS.ProcessEnv, target: QualityTarget): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [strykerBinPath(), ...args], {
      cwd: REPO_ROOT,
      env,
      stdio: 'inherit'
    });
    const progressTimer = setInterval(() => {
      console.error(
        `[mutation] Still running ${target.relativePath} after ${formatElapsedDuration(Date.now() - startedAt)}...`
      );
    }, MUTATION_PROGRESS_INTERVAL_MS);
    const clearProgressTimer = () => {
      clearInterval(progressTimer);
    };

    child.once('error', (error) => {
      clearProgressTimer();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearProgressTimer();
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Stryker exited with ${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}.`));
    });
  });
}

export async function runMutation(target: QualityTarget, options: MutationRunOptions = {}): Promise<void> {
  const { args, reportKey } = buildMutationArgs(target, options);
  await runStryker(args, buildMutationEnv(options), target);
  const reportPath = copySharedMutationReports(reportKey, REPO_ROOT);
  reportMutationSiteViolations(reportPath);
}

export type { MutationRunOptions };
export { buildMutationArgsForTest };
