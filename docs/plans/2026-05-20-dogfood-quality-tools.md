# Dogfood Quality Tools

## Goal

Use `@poleski/quality-tools` against its own package and follow the tool output
until the tools report useful, low-noise signals for each tool folder.

Current host-project setup, configuration fields, and command usage live in the
package [README](../../README.md).

## Tool Folders

The quality-tools package currently has these command-owned tool folders:

- `src/boundaries`
- `src/reachability`
- `src/organize`
- `src/scrap`
- `src/crap`
- `src/mutation`

## Dogfood Loop

For each tool folder, run each quality tool on that current folder and address
actionable findings before moving to the next folder.

```bash
pnpm run quality-tools -- organize <tool-folder>
pnpm run quality-tools -- boundaries <tool-folder> --strict
pnpm run quality-tools -- reachability <tool-folder> --strict
pnpm run quality-tools -- scrap <tool-folder> --strict
pnpm run quality-tools -- crap <tool-folder>
pnpm run quality-tools -- mutate -- --mutate <tool-folder>
```

Good signal means:

- `organize` has no clear split/rename recommendation worth doing now.
- `boundaries` and `reachability` report no dead surfaces, dead ends, or layer
  violations for the selected folder.
- `scrap` has no concrete test-structure recommendation for the selected tool.
- `crap` reports every selected function at or below the configured threshold.
- `mutate` clears the configured Stryker thresholds for the selected folder.

## Current Portability Decisions

- Tools discover workspace packages from `pnpm-workspace.yaml` or
  `package.json#workspaces`.
- Package shorthand comes from workspace package names, not from a hardcoded
  folder layout.
- CRAP coverage commands and coverage report paths come from
  `quality.config.json`.
- Mutation delegates Vitest integration to the host Stryker config and does not
  run typecheck before Stryker.
- Organize, scrap, and mutation artifacts all write under the configured
  `reportsDir`.
