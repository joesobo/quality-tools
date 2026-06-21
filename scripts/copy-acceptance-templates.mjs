import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/cli/templates', { recursive: true });
cpSync(
  'src/acceptance/playwright/templates/playwright-acceptance-runtime.ts.template',
  'dist/cli/templates/playwright-acceptance-runtime.ts.template'
);
