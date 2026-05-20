# @poleski/quality-tools

Portable TypeScript quality checks for project structure, complexity, mutation,
and test health.

## Install

```bash
pnpm add -D @poleski/quality-tools
pnpm exec quality-tools init
```

During local development before publish, link the package from this repo:

```bash
pnpm add -D link:/absolute/path/to/quality-tools/packages/quality-tools
```

## Commands

```bash
pnpm exec quality-tools organize .
pnpm exec quality-tools boundaries . --strict
pnpm exec quality-tools reachability . --strict
pnpm exec quality-tools crap ./src
pnpm exec quality-tools mutate ./src/parser.ts
pnpm exec quality-tools scrap ./tests
```

Targets can be a project root, package shorthand, directory, or file. The CLI
finds `quality.config.json` from the current project and writes tool reports
under `reports/quality-tools` by default.

## Config

Run `quality-tools init` to create a starter `quality.config.json`. Host repos
own their config, report paths, coverage command shape, and mutation targets.
The package owns the analyzers and the Stryker/Vitest integration.

## Package Layout

- `src/cli/` thin command entrypoints
- `src/config/` shared quality config loading
- `src/boundaries/` dependency boundary and dead-surface analysis
- `src/reachability/` dead-surface and dead-end reporting
- `src/organize/` directory structure, naming, and cohesion analysis
- `src/crap/` complexity and coverage risk analysis
- `src/mutation/` mutation orchestration and mutation-site checks
- `src/scrap/` test-structure quality and refactor guidance
- `src/shared/` path, target, workspace, and command helpers
- `tests/` source-mapped test coverage
