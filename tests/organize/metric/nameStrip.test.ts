import { describe, expect, it } from 'vitest';
import { stripExtension } from '../../../src/organize/metric/naming/nameStrip';

describe('stripExtension', () => {
  it.each([
    ['utils.test.ts', 'utils'],
    ['Component.test.tsx', 'Component'],
    ['helpers.spec.ts', 'helpers'],
    ['helpers.spec.js', 'helpers'],
    ['model.ts', 'model'],
    ['Button.tsx', 'Button'],
    ['index.js', 'index'],
    ['Component.jsx', 'Component'],
    ['utils.service.ts', 'utils.service'],
    ['README', 'README'],
    ['.ts', '.ts'],
    ['.gitignore', '.gitignore'],
    ['', ''],
    ['_shared.ts', '_shared'],
    ['my-file.ts', 'my-file'],
    ['MyComponent.tsx', 'MyComponent'],
    ['api.client.ts', 'api.client'],
    ['api.client.test.ts', 'api.client']
  ])('strips extension from %s', (fileName, expected) => {
    expect(stripExtension(fileName)).toBe(expected);
  });
});
