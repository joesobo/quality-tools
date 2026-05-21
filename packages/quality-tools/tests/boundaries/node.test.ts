import { describe, expect, it } from 'vitest';
import { createNode } from '../../src/boundaries/graph/node';

describe('createNode', () => {
  it('classifies layers and entrypoints from package-relative patterns', () => {
    expect(
      createNode(
        '/repo/packages/extension/src/extension/activate.ts',
        'extension',
        'src/extension/activate.ts',
        'packages/extension/src/extension/activate.ts',
        [
          { allow: ['shared'], include: ['src/extension/**'], name: 'extension' },
          { allow: [], include: ['src/shared/**'], name: 'shared' },
        ],
        ['src/extension/activate.ts']
      )
    ).toMatchObject({
      entrypoint: true,
      layer: 'extension',
      packageName: 'extension',
      packageRelativePath: 'src/extension/activate.ts',
      relativePath: 'packages/extension/src/extension/activate.ts'
    });
  });

  it('leaves layer undefined when no layer matches', () => {
    expect(
      createNode(
        '/repo/packages/extension/src/misc/file.ts',
        'extension',
        'src/misc/file.ts',
        'packages/extension/src/misc/file.ts',
        [{ allow: [], include: ['src/shared/**'], name: 'shared' }],
        []
      )
    ).toMatchObject({
      entrypoint: false,
      layer: undefined
    });
  });

  it('matches a layer when any include pattern matches', () => {
    expect(
      createNode(
        '/repo/packages/extension/src/model/user.ts',
        'extension',
        'src/model/user.ts',
        'packages/extension/src/model/user.ts',
        [
          {
            allow: [],
            include: ['src/core/**', 'src/model/**'],
            name: 'domain'
          }
        ],
        []
      )
    ).toMatchObject({
      layer: 'domain'
    });
  });
});
