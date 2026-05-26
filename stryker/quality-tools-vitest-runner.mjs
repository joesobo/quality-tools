import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { createRequire } from 'node:module';
import { INSTRUMENTER_CONSTANTS } from '@stryker-mutator/api/core';
import { declareFactoryPlugin, PluginKind, commonTokens, tokens } from '@stryker-mutator/api/plugin';

const require = createRequire(import.meta.url);
const vitestRunnerRoot = path.dirname(require.resolve('@stryker-mutator/vitest-runner/package.json'));
const { VitestTestRunner } = await import(path.join(vitestRunnerRoot, 'dist/src/vitest-test-runner.js'));
const { vitestWrapper } = await import(path.join(vitestRunnerRoot, 'dist/src/vitest-wrapper.js'));

const STRYKER_SETUP = path.join(vitestRunnerRoot, 'dist/src/stryker-setup.js');
const STRYKER_SETUP_SOURCE_MAP = 'stryker-setup.js.map';

export const strykerValidationSchema = JSON.parse(
  fs.readFileSync(path.join(vitestRunnerRoot, 'dist/schema/vitest-runner-options.json'), 'utf-8'),
);

function createStrykerSetupSourceMap(setupFilePath) {
  return JSON.stringify({
    version: 3,
    file: path.basename(setupFilePath),
    sources: [],
    names: [],
    mappings: '',
  });
}

class QualityToolsVitestTestRunner extends VitestTestRunner {
  async init() {
    this.setEnv();
    await fs.promises.copyFile(STRYKER_SETUP, this.localSetupFile);
    await fs.promises.writeFile(
      path.resolve(path.dirname(this.localSetupFile), STRYKER_SETUP_SOURCE_MAP),
      createStrykerSetupSourceMap(this.localSetupFile),
    );

    this.ctx = await vitestWrapper.createVitest('test', {
      config: this.options.vitest?.configFile,
      pool: 'forks',
      coverage: { enabled: false },
      watch: false,
      dir: this.options.vitest?.dir,
      bail: this.options.disableBail ? 0 : 1,
      onConsoleLog: () => false,
    });
    this.ctx.provide('globalNamespace', this.globalNamespace);
    this.ctx.provide(
      'isGreaterThanVitest4Point1',
      semver.satisfies(vitestWrapper.version, '>=4.1.0'),
    );
    this.ctx.config.browser.screenshotFailures = false;
    this.ctx.projects.forEach((project) => {
      project.config.setupFiles = [
        this.localSetupFile,
        ...project.config.setupFiles,
      ];
      project.config.browser.screenshotFailures = false;
    });
    if (this.log.isDebugEnabled()) {
      this.log.debug(`vitest final config: ${JSON.stringify(this.ctx.config, null, 2)}`);
    }
  }
}

function createQualityToolsVitestTestRunnerFactory(
  namespace = INSTRUMENTER_CONSTANTS.NAMESPACE,
) {
  createQualityToolsVitestTestRunner.inject = tokens(commonTokens.injector);
  function createQualityToolsVitestTestRunner(injector) {
    return injector
      .provideValue('globalNamespace', namespace)
      .injectClass(QualityToolsVitestTestRunner);
  }
  return createQualityToolsVitestTestRunner;
}

export const qualityToolsVitestTestRunnerFactory = createQualityToolsVitestTestRunnerFactory();

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.TestRunner,
    'quality-tools-vitest',
    qualityToolsVitestTestRunnerFactory,
  ),
];
