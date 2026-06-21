# Acceptance Dogfood Quality

## Goal

Hold the acceptance pipeline upgrade to the same quality-tools standards it
adds for host projects.

## Decisions

- Do not keep bundled `dist/` output under review. The source package owns the
  CLI implementation, and `dist/` is a generated publish artifact.
- Build before publish and CI verification rather than reviewing a multi-
  thousand-line bundled CLI file.
- Dogfood the acceptance implementation with the existing tools while it is in
  development:

  ```bash
  pnpm run quality-tools -- organize src/acceptance
  pnpm run quality-tools -- boundaries src/acceptance --strict
  pnpm run quality-tools -- reachability src/acceptance --strict
  pnpm run quality-tools -- scrap tests/acceptance --strict
  pnpm run quality-tools -- crap src/acceptance
  ```

## Current Findings

- Boundaries and reachability report no acceptance-folder violations.
- CRAP flagged the first implementation pass in `parser.ts`, `command.ts`, and
  `dryChecker.ts`; those should be refactored before the PR ships.
- Scrap flagged parser tests as a candidate for table-driving.
- Organize currently reports no directories for `src/acceptance` even though it
  contains files; that should become a separate organize-target follow-up.

## Packaging Note

Git-hosted package builds are awkward with pnpm 10.26 and newer because git
dependency `prepare` scripts must be explicitly allowed by the consuming repo.
For CodeGraphy's temporary branch dependency, either consume a published package
or explicitly allow the `@poleski/quality-tools` build in that PR while it
depends on a git branch.
