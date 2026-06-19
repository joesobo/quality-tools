# Acceptance Pipeline Upgrade

## Goal

Evolve `quality-tools acceptance` from a direct feature-to-Playwright compiler
into a small acceptance pipeline:

```txt
Gherkin feature specs
  -> JSON IR
  -> advisory IR DRY report
  -> generated Playwright entrypoints
```

This follows the shape of Uncle Bob's Acceptance Pipeline Specification while
keeping this package TypeScript-native and host-project-neutral.

## Decisions

- Use `.feature` files as the human-authored source format.
- Treat parsed JSON IR as the canonical generator input.
- Make DRY analysis advisory only. It must not rewrite Gherkin, IR, generated
  files, step bindings, or host implementation code.
- Generate thin Playwright entrypoints that load JSON IR. Runtime behavior stays
  in shared generated helper code plus host-owned step handlers.
- Expose Uncle Bob-style primitive commands: `parse`, `dry-check`, and
  `generate`. Keep `compile` as the glob loop for host projects with many specs.
- Support split generated output by source spec, but keep a single-file output
  mode for existing hosts during migration.
- Do not implement acceptance mutation in this slice.

## First Upgrade Slice

1. Add JSON IR serialization for parsed acceptance documents.
2. Add an IR DRY checker for duplicate-in-scenario, exact duplicate,
   placeholder-variant, repeated-step-pattern, repeated-scenario-shape,
   near-duplicate, and possible-synonym findings.
3. Add a split output mode that writes one thin generated Playwright spec per
   source feature spec plus one shared runtime.
4. Update CodeGraphy to consume the split output mode and verify generation,
   typecheck, and CI-friendly Playwright discovery without running local
   Playwright.
