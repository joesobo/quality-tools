const path = require('node:path');

const packageRoot = __dirname;
const hostRoot = process.cwd();
const vitestConfig = process.env.QUALITY_TOOLS_VITEST_CONFIG ?? 'vitest.config.ts';

module.exports = {
  $schema: 'https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/core/schema/stryker-core.schema.json',
  packageManager: process.env.QUALITY_TOOLS_PACKAGE_MANAGER ?? 'pnpm',
  testRunner: 'quality-tools-vitest',
  plugins: [
    path.join(packageRoot, 'stryker/quality-tools-vitest-runner.mjs'),
    '@stryker-mutator/vitest-runner',
  ],
  vitest: {
    configFile: path.isAbsolute(vitestConfig) ? vitestConfig : path.join(hostRoot, vitestConfig),
    related: false,
  },
  reporters: [
    'clear-text',
    'json',
    'html',
  ],
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  concurrency: 1,
  coverageAnalysis: 'perTest',
  maxTestRunnerReuse: 1,
  testRunnerNodeArgs: [
    '--max-old-space-size=8192',
  ],
  dryRunTimeoutMinutes: 30,
  incremental: true,
  incrementalFile: 'reports/mutation/stryker-incremental.json',
  ignorePatterns: [
    '/coverage',
    '/.vscode-test',
    '/.vscode-test/**',
    '/.stryker-tmp',
    '/.stryker-tmp/**',
  ],
  ignoreStatic: true,
  thresholds: {
    high: 90,
    low: 80,
    break: null,
  },
};
