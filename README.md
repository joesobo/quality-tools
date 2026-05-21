# Quality Tools

Standalone repository for `@poleski/quality-tools`.

The npm package lives in `packages/quality-tools` and exposes a `quality-tools`
CLI for project-agnostic structure, complexity, mutation, reachability, and
test-shape checks.

## Local Development

```bash
pnpm install
pnpm run ci
```

The CI check runs:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Before the package is published, test it from another project with a local link:

```bash
pnpm run build
pnpm add -D link:/absolute/path/to/quality-tools/packages/quality-tools
pnpm exec quality-tools --help
```

## Package Usage

See [packages/quality-tools/README.md](packages/quality-tools/README.md) for
host-project setup, configuration, report output, CRAP coverage wiring, and
mutation/Stryker integration.

## Changesets

Use Changesets for version bumps and release notes:

```bash
pnpm changeset
pnpm version-packages
```
