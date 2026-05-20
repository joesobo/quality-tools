#!/usr/bin/env node

import { runBoundariesCli } from '../boundaries/command';
import { runCrapCli } from '../crap/command';
import { runInitCli } from './init';
import { runMutationCli } from '../mutation/runner/command';
import { runOrganizeCli } from '../organize/command';
import { runReachabilityCli } from '../reachability/command';
import { runScrapCli } from '../scrap/command';
import { cleanCliArgs } from '../shared/cliArgs';

const COMMANDS = {
  boundaries: runBoundariesCli,
  crap: runCrapCli,
  init: runInitCli,
  mutate: runMutationCli,
  organize: runOrganizeCli,
  reachability: runReachabilityCli,
  scrap: runScrapCli
};

function printHelp(): void {
  console.log(`quality-tools <command> [target] [flags]

Commands:
  init          Create a starter quality.config.json
  organize     Check folder structure, naming, and cohesion
  boundaries   Check package/layer boundaries
  reachability Check dead surfaces and dead ends
  crap         Check complexity and coverage risk
  mutate       Run mutation testing through the configured runner
  scrap        Check test structure and refactor pressure
`);
}

const [command, ...args] = cleanCliArgs(process.argv.slice(2));

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

const run = COMMANDS[command as keyof typeof COMMANDS];

if (!run) {
  console.error(`Unknown quality-tools command: ${command}`);
  printHelp();
  process.exit(1);
}

run(args);
