#!/usr/bin/env tsx

import { runAcceptanceCli } from '../acceptance/command';

try {
  await runAcceptanceCli(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
