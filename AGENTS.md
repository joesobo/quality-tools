# AGENTS.md

## Rules

- Write plans and decisions into files before large changes.
- Use `rg` for text search and `fd` for file discovery.
- Fix behavior changes with tests first when practical.
- Keep the package generic: no host-project names in core code, CLI flags, docs, or environment variables.
- Treat Stryker, Vitest, package-manager commands, coverage locations, and report paths as host-configurable integration details.

## Commands

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run typecheck
```

## Architecture

- `src/cli/` contains thin command entrypoints.
- `src/config/` owns quality-tool config loading and defaults.
- `src/shared/` owns path, target, workspace, and command helpers.
- Tool implementations live in feature folders such as `src/crap/`, `src/scrap/`, `src/boundaries/`, `src/reachability/`, `src/organize/`, and `src/mutation/`.
- Tests mirror source modules under `tests/`.
