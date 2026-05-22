import { relative, sep } from 'path';

export function toPosix(value: string): string {
  return value.replace(/\\/g, '/').split(sep).join('/');
}

export function relativeTo(root: string, value: string): string {
  return toPosix(relative(root, value));
}
