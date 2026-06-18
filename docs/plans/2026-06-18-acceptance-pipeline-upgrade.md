# Acceptance Pipeline Upgrade

## Goal

Evolve `quality-tools acceptance` from a direct Markdown-to-Playwright compiler
into a small acceptance pipeline:

```txt
Markdown specs
  -> JSON IR
  -> advisory IR DRY report
  -> generated Playwright entrypoints
```

This follows the shape of Uncle Bob's Acceptance Pipeline Specification while
keeping this package TypeScript-native and host-project-neutral.

## Decisions

- Keep Markdown as the human-authored source format for now.
- Treat parsed JSON IR as the canonical generator input.
- Make DRY analysis advisory only. It must not rewrite Markdown, IR, generated
  files, step bindings, or host implementation code.
- Generate thin Playwright entrypoints. Runtime behavior stays in shared helper
  code plus host-owned step handlers.
- Support split generated output by source spec, but keep a single-file output
  mode for existing hosts during migration.
- Do not implement acceptance mutation in this slice.

## First Upgrade Slice

1. Add JSON IR serialization for parsed acceptance documents.
2. Add an IR DRY checker for duplicate-in-scenario, exact duplicate,
   placeholder-variant, near-duplicate, and possible-synonym findings.
3. Add a split output mode that writes one generated Playwright spec per source
   Markdown spec.
4. Update CodeGraphy to consume the split output mode and verify generation,
   typecheck, and CI-friendly Playwright discovery without running local
   Playwright.
