import { describe, expect, it } from 'vitest';
import { pathRedundancy } from '../../../src/organize/metric/naming/redundancy';

describe('pathRedundancy', () => {
  it.each([
    ['scrap/scrapTypes.ts', ['scrap'], 0.5],
    ['scrap/types.ts', ['scrap'], 0],
    ['src/scrap/scrapTypes.ts', ['src', 'scrap'], 0.5],
    ['scrap/data/scrapData.ts', ['scrap', 'data'], 1],
    ['utils/utils.ts', ['utils'], 1],
    ['src/metrics.ts', ['src'], 0],
    ['src/lib/utils/metrics.ts', ['src', 'lib', 'utils'], 0],
    ['metrics.ts', [], 0],
    ['config.ts', [], 0],
    ['scrap/scrapData', ['scrap'], 0.5],
    ['src/config.ts', ['lib'], 0],
    ['reports/getReportData.ts', ['reports'], 0],
    ['reports/report-data.ts', ['reports'], 0],
    ['scrap/scrapMetrics.ts', ['scrap', 'lib'], 0.5],
    ['test/test.ts', ['test', 'test'], 1],
    ['webview/app/App.tsx', ['webview', 'app'], 0],
    ['webview/export/settings/export.ts', ['webview', 'export', 'settings'], 0],
    ['webview/theme/useTheme.ts', ['webview', 'theme'], 0],
    ['features/editor/useEditorState.ts', ['features', 'editor'], 0],
    ['webview/app/appState.tsx', ['webview', 'app'], 0.5],
    ['SCRAP/ScrapData.ts', ['SCRAP'], 0.5],
    ['src/.ts', ['src'], 0],
    ['src/---', ['src'], 0],
    ['utils/arrayUtils.ts', ['utils'], 0.5],
    ['services/user/userService.ts', ['services', 'user'], 0.5],
    ['src/config/app/config.ts', ['src', 'config', 'app'], 1]
  ] as const)('returns %s for %s under %j', (fileName, ancestors, expected) => {
    expect(pathRedundancy(fileName, [...ancestors])).toBeCloseTo(expected, 5);
  });

  it('scores partial overlap with a non-terminating fraction', () => {
    expect(pathRedundancy('report/blocks/reportBlockData.ts', ['report', 'blocks'])).toBeCloseTo(1 / 3, 5);
  });
});
