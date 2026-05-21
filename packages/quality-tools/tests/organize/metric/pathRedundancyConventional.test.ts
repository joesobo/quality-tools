import { describe, expect, it } from 'vitest';
import { isConventionalEntryFile } from '../../../src/organize/metric/naming/conventional';

describe('isConventionalEntryFile', () => {
  it.each([
    ['webview/settings/index.ts', ['webview', 'settings'], true],
    ['webview/app/App.tsx', ['webview', 'app'], true],
    ['webview/export/export.ts', ['webview', 'export'], true],
    ['webview/export/export.ts', ['webview', 'reports'], false],
    ['webview/app/router.ts', ['webview', 'app'], false],
    ['webview/export/report.ts', ['webview', 'export'], false],
    ['features/editor/useEditorState.ts', ['features', 'editor'], true],
    ['features/theme/useEditorState.ts', ['features', 'theme'], false],
    ['features/theme/use.ts', ['features', 'theme'], false],
    ['features/editorPanel/getEditorState.ts', ['features', 'editorPanel'], false],
    ['features/use/useEditorState.ts', ['features', 'use'], false],
    ['features/editor-panel/useEditorState.ts', ['features', 'editorPanel'], true],
    ['reports/export.ts', ['reports', 'editor'], false]
  ] as const)('returns %s for %s', (fileName, folders, expected) => {
    expect(isConventionalEntryFile(fileName, [...folders])).toBe(expected);
  });
});
