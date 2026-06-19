# Acceptance Specs Tool

## Goal

Add a generic `quality-tools acceptance` tool that turns human-authored
Gherkin `.feature` files into executable acceptance tests for host projects.

## Design Decisions

- Human acceptance specs live in `.feature` files, not TypeScript.
- Specs use a small Gherkin vocabulary: `Feature`, `Scenario`, `Given`,
  `When`, `Then`, `And`, and `But`.
- `quality-tools` owns parsing and Playwright test generation.
- Host projects own step bindings and fixtures because only the host knows how
  to open its app, drive its UI, and make assertions.
- The tool should generate plain Playwright tests from parsed specs instead of
  requiring Cucumber as the runtime.
- Generated tests should preserve source file and line information so failures
  point back to the human spec.

## First Slice

1. Parse one Gherkin feature with one scenario and several steps.
2. Generate one Playwright spec that imports host step bindings.
3. Add a CLI command:

   ```bash
   quality-tools acceptance compile \
     --spec "tests/acceptance/specs/**/*.feature" \
     --steps "tests/acceptance/steps.ts" \
     --out "tests/playwright/generated/acceptance.spec.ts"
   ```

4. Use the command from CodeGraphy's VS Code Playwright E2E lane.

## Guardrails

- Keep the package generic: no CodeGraphy-specific names in source, CLI flags,
  tests, or docs.
- Prefer exact, understandable behavior over a broad Cucumber clone.
- Add one behavior test at a time and keep each test against public parser,
  generator, or CLI surfaces.
