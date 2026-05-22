import { describe, expect, it } from 'vitest';
import { checkLowInfoName, type LowInfoNameConfig } from '../../../src/organize/metric/naming/lowInfo';

const defaultConfig: LowInfoNameConfig = {
  banned: ['utils', 'helpers', 'misc', 'common', 'shared', '_shared', 'lib', 'index'],
  discouraged: ['types', 'constants', 'config', 'base', 'core']
};

describe('checkLowInfoName', () => {
  it.each([
    ['utils.ts', undefined, 'low-info-banned', 'Catch-all dumping ground'],
    ['helpers.ts', undefined, 'low-info-banned', 'Vague semantics'],
    ['types.ts', undefined, 'low-info-discouraged', 'dump for unrelated type definitions'],
    ['constants.ts', undefined, 'low-info-discouraged', 'dump for unrelated values'],
    ['index.ts', false, 'low-info-banned', undefined],
    ['index.ts', undefined, 'low-info-banned', undefined],
    ['Utils.ts', undefined, 'low-info-banned', undefined],
    ['HELPERS.TS', undefined, 'low-info-banned', undefined],
    ['Types.tsx', undefined, 'low-info-discouraged', undefined],
    ['utils.test.ts', undefined, 'low-info-banned', undefined],
    ['helpers.spec.tsx', undefined, 'low-info-banned', undefined],
    ['misc.ts', undefined, 'low-info-banned', undefined],
    ['utils.test.tsx', undefined, 'low-info-banned', undefined],
    ['helpers.spec.js', undefined, 'low-info-banned', undefined],
    ['utils', undefined, 'low-info-banned', undefined],
    ['types', undefined, 'low-info-discouraged', undefined],
    ['utils.other', undefined, 'low-info-banned', undefined],
    ['common.ts', undefined, 'low-info-banned', undefined]
  ] as const)('flags %s as %s', (fileName, isPackageEntryPoint, expectedKind, detailText) => {
    const issue = checkLowInfoName(fileName, defaultConfig, isPackageEntryPoint);

    expect(issue).toMatchObject({
      fileName,
      kind: expectedKind
    });
    if (detailText) {
      expect(issue?.detail).toContain(detailText);
    }
  });

  it.each([
    ['analyze.ts', undefined],
    ['index.ts', true],
    ['normalname', undefined],
    ['.ts', undefined],
    ['utils.service.ts', undefined],
    ['model.ts', undefined]
  ] as const)('allows %s', (fileName, isPackageEntryPoint) => {
    expect(checkLowInfoName(fileName, defaultConfig, isPackageEntryPoint)).toBeUndefined();
  });

  const customNameCases: Array<[string, LowInfoNameConfig]> = [
    ['junk.ts', { banned: ['junk'], discouraged: [] }],
    ['orphaned.ts', { banned: [], discouraged: ['orphaned'] }]
  ];

  it.each(customNameCases)('uses a generic detail for custom low-info name %s', (fileName, config) => {
    const issue = checkLowInfoName(fileName, config);

    expect(issue?.detail).toBe('Low-information filename');
  });

  it.each([
    ['utils', 'low-info-banned'],
    ['helpers', 'low-info-banned'],
    ['misc', 'low-info-banned'],
    ['common', 'low-info-banned'],
    ['shared', 'low-info-banned'],
    ['_shared', 'low-info-banned'],
    ['lib', 'low-info-banned'],
    ['index', 'low-info-banned'],
    ['types', 'low-info-discouraged'],
    ['constants', 'low-info-discouraged'],
    ['config', 'low-info-discouraged'],
    ['base', 'low-info-discouraged'],
    ['core', 'low-info-discouraged'],
    ['UTILS', 'low-info-banned'],
    ['Helpers', 'low-info-banned'],
    ['MISC', 'low-info-banned'],
    ['Common', 'low-info-banned'],
    ['Shared', 'low-info-banned'],
    ['_SHARED', 'low-info-banned'],
    ['LIB', 'low-info-banned'],
    ['INDEX', 'low-info-banned'],
    ['TYPES', 'low-info-discouraged'],
    ['Constants', 'low-info-discouraged'],
    ['CONFIG', 'low-info-discouraged'],
    ['Base', 'low-info-discouraged'],
    ['CORE', 'low-info-discouraged']
  ] as const)('matches configured name %s case-insensitively', (name, expectedKind) => {
    expect(checkLowInfoName(`${name}.ts`, defaultConfig)?.kind).toBe(expectedKind);
  });

  it('only applies the package entry point exemption to index files', () => {
    expect(checkLowInfoName('index.ts', defaultConfig, true)).toBeUndefined();
    expect(checkLowInfoName('utils.ts', defaultConfig, true)).toMatchObject({
      fileName: 'utils.ts',
      kind: 'low-info-banned'
    });
  });
});
