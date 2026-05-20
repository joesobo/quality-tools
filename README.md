# Quality Tools

Standalone repository for `@poleski/quality-tools`.

The npm package lives in `packages/quality-tools` and exposes a `quality-tools`
CLI for running quality checks against host-project folders and files.

## Local Development

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run typecheck
```

For local development in a host project before the package is published, build
the CLI and link the package:

```bash
pnpm run build
pnpm add -D link:/Users/poleski/Desktop/Projects/quality-tools/packages/quality-tools
pnpm exec quality-tools --help
```
