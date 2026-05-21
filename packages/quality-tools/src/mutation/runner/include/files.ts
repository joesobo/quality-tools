import { baseTestRoots } from './roots';
import { directIncludes } from './direct';
import { fallbackIncludes } from './fallback';
import { fileIncludeParts } from './parts';

export function fileIncludes(packageName: string, relativeSourceFile: string): string[] {
  const parts = fileIncludeParts(relativeSourceFile);

  return [...new Set(
    baseTestRoots(packageName).flatMap((root) => {
      return [
        ...directIncludes(root, parts),
        ...fallbackIncludes(root, parts),
      ];
    }),
  )];
}
