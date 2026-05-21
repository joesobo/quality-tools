# Dogfood Quality Tools

## Goal

Use `@poleski/quality-tools` against its own repository and follow the tool output to improve structure, coverage-risk, dead-code signal, test shape, and scoped mutation confidence.

## Constraints

- Keep the package generic; do not add host-project-specific naming or assumptions.
- Use the local package CLI through `pnpm run quality-tools -- ...`.
- For the second dogfood pass, run mutation on the current tool folder rather
  than a single file when the folder is small enough to finish in a useful time.
- Prefer small refactors with focused tests over broad rewrites.

## Baseline Commands

```bash
pnpm run quality-tools -- organize quality-tools
pnpm run quality-tools -- boundaries quality-tools --strict
pnpm run quality-tools -- reachability quality-tools --strict
pnpm run quality-tools -- scrap quality-tools
pnpm run quality-tools -- crap quality-tools
```

## Tool-By-Tool Matrix

Command-owned tool folders:

- `packages/quality-tools/src/boundaries`
- `packages/quality-tools/src/reachability`
- `packages/quality-tools/src/organize`
- `packages/quality-tools/src/scrap`
- `packages/quality-tools/src/crap`
- `packages/quality-tools/src/mutation`

For each folder, run and iterate until signals are acceptable:

```bash
pnpm run quality-tools -- organize <tool-folder>
pnpm run quality-tools -- boundaries <tool-folder> --strict
pnpm run quality-tools -- reachability <tool-folder> --strict
pnpm run quality-tools -- scrap <tool-folder>
pnpm run quality-tools -- crap <tool-folder>
pnpm run quality-tools -- mutate --mutate <tool-folder>
```

Good signal means no blocking dead-code/boundary/CRAP/mutation failures, and no
organize/scrap recommendation that is clearly actionable for that current tool
folder without broad unrelated redesign.

## Iteration Notes

### Tool matrix pass: `boundaries`

- `organize packages/quality-tools/src/boundaries` initially reported `[SPLIT]`
  for 12 files and one imports-only cluster. Split the tool into
  `boundaries/graph/` and `boundaries/report/`; rerun now reports
  `No directories found for organize analysis.`
- `boundaries packages/quality-tools/src/boundaries --strict` and
  `reachability packages/quality-tools/src/boundaries --strict` initially
  reported the entire package instead of the selected tool folder. Fixed
  directory/file target scoping so the package graph is still used for edges,
  while reports are limited to the selected scope. Rerun reports 13 files, 0
  layer violations, 0 dead surfaces, and 0 dead ends.
- `scrap packages/quality-tools/src/boundaries` initially could not find tests
  for a source-folder target. Added source-to-test folder mapping, then fixed a
  `scrap` false positive where already table-driven examples were still told to
  table-drive. Rerun has no validation issues and no concrete recommendations
  for the boundaries test files.
- `crap packages/quality-tools/src/boundaries` reports all functions have CRAP
  score <= 8 with 100% coverage for the boundaries source group.
- First `mutate --mutate packages/quality-tools/src/boundaries` pass cleared
  threshold but surfaced surviving mutants in dead-surface filtering, layer
  matching, allowed-layer fallback, and the custom target fallback. Added
  focused assertions, split scope/report shaping out of package analysis, and
  removed the unreachable fallback. Final rerun: 13 source files, 14 matching
  test files, 240/240 mutants killed, 100% mutation score, all files within the
  50 mutation-site threshold.

- Baseline `organize` found low-information `types.ts` modules in `boundaries`,
  `organize`, `reachability`, and `scrap`, plus a repeated `include` cluster in
  `mutation/runner`.
- Renamed feature data modules to `model.ts`, moved mutation include helpers to
  `mutation/runner/include/`, and then renamed those files to path-aware roles
  (`direct`, `fallback`, `files`, `parts`, `roots`, `vitest`).
- Renamed organize configuration to `rules.ts` and the mutation config test to
  `strykerIgnorePatterns.test.ts`, clearing the low-info config/test warnings.
- `scrap` originally reported `tests/boundaries/command.test.ts` and
  `tests/boundaries/selection.test.ts` as `SPLIT`; after table-driving repeated
  cases and extracting boundary config setup, both report as `LOCAL`.
- Dogfooding scoped mutation on
  `packages/quality-tools/src/mutation/runner/include/roots.ts` exposed that the
  Stryker integration used the wrong Vitest config root and did not pass scoped
  tests through Stryker's own `--testFiles` option. Fixed the runner to pass a
  package-local Vitest config, package test dir, expanded concrete test files,
  and `--testFiles`.
- Scoped mutation result for `roots.ts`: 1 source file, 6 scoped test files, 29
  initial dry-run tests, 15/15 mutants killed, 100% mutation score.
- Final dead-code gates:
  `boundaries quality-tools --strict` and `reachability quality-tools --strict`
  both report 169 files, 0 layer violations, 0 dead surfaces, and 0 dead ends.
- Final CRAP gate: 212 test files, 1,539 tests, 98.32% statement coverage, and
  all functions have CRAP score <= 8.

### Tool matrix pass: `reachability`

- `organize packages/quality-tools/src/reachability` reports
  `No directories found for organize analysis.`
- `boundaries packages/quality-tools/src/reachability --strict` and
  `reachability packages/quality-tools/src/reachability --strict` both report
  4 files, 0 layer violations, 0 dead surfaces, and 0 dead ends.
- `scrap packages/quality-tools/src/reachability` initially reported
  `tests/reachability/command.test.ts` as `SPLIT` with an `EXTRACT_SETUP`
  recommendation. Extracted the CLI report setup into `runWithReport` and
  table-drove the repeated flag and failure-mode examples. Rerun reports
  `LOCAL` with no recommendations for the reachability tests.
- `crap packages/quality-tools/src/reachability` reports all functions have
  CRAP score <= 8, with 100% statements/lines/functions coverage and 95% branch
  coverage for the reachability source group.
- `mutate --mutate packages/quality-tools/src/reachability` finished with 4
  source files, 4 matching test files, 72/73 mutants killed, 0 survivors, 1
  no-coverage string-literal mutant in optional report label formatting, 98.63%
  mutation score, and all files within the 50 mutation-site threshold.

### Tool matrix pass: `organize`

- `organize packages/quality-tools/src/organize` initially reported a large
  feature folder. Split the tool into behavior-owned subfolders:
  `analyze/`, `compare/`, `cohesion/cluster/`, `cohesion/imports/`,
  `metric/barrel/`, `metric/naming/`, `metric/walk/`, and `naming/`. Rerun now
  reports `No directories found for organize analysis.`
- `boundaries packages/quality-tools/src/organize --strict` reports 41 files,
  0 layer violations, 0 dead surfaces, and 0 dead ends.
- `reachability packages/quality-tools/src/organize --strict` reports 41 files,
  0 dead surfaces, and 0 dead ends.
- `scrap packages/quality-tools/src/organize --strict` initially failed on a
  stale, 63-example `command.mutations.test.ts` suite. Extracted stronger
  focused command tests in `runOrganizeCli.combinations.test.ts`, deleted the
  redundant catch-all mutation suite, and tuned `scrap` so strict manual-split
  gating is reserved for severe test-file pressure while medium files remain
  advisory. Final rerun exits 0 with no split or review-first files.
- `crap packages/quality-tools/src/organize` runs the full covered test suite
  and reports all functions have CRAP score <= 8. The organize source group is
  at 100% statements, functions, and lines coverage, with 96.29% branch
  coverage.
- First organize mutation rerun after deleting the stale command suite produced
  7 surviving mutants in `organize/command.ts` around `--compare` parsing and
  comparison attachment. Added a focused comparison-path/report assertion.
  Final rerun: 41 source files, 47 matching test files, 947 killed, 6 timed
  out, 0 survivors, 0 no-coverage mutants, 100% mutation score, and all files
  within the 50 mutation-site threshold.
