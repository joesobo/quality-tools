# Dogfood Quality Tools

## Goal

Use `@poleski/quality-tools` against its own repository and follow the tool output to improve structure, coverage-risk, dead-code signal, test shape, and scoped mutation confidence.

## Constraints

- Keep the package generic; do not add host-project-specific naming or assumptions.
- Use the local package CLI through `pnpm run quality-tools -- ...`.
- Run mutation checks only on individual files or very narrow globs.
- Prefer small refactors with focused tests over broad rewrites.

## Baseline Commands

```bash
pnpm run quality-tools -- organize quality-tools
pnpm run quality-tools -- boundaries quality-tools --strict
pnpm run quality-tools -- reachability quality-tools --strict
pnpm run quality-tools -- scrap quality-tools
pnpm run quality-tools -- crap quality-tools
```

## Iteration Notes

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
