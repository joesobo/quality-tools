# @poleski/quality-tools

Portable TypeScript quality checks for project structure, complexity,
reachability, mutation, and test health.

The tools are intentionally project-agnostic. They discover packages from
`pnpm-workspace.yaml` or `package.json#workspaces`, accept explicit file/folder
targets, and read project-specific behavior from `quality.config.json`.

## Install

```bash
pnpm add -D @poleski/quality-tools
pnpm exec quality-tools init
```

Before publish, use a local link from a host project:

```bash
pnpm add -D link:/absolute/path/to/quality-tools/packages/quality-tools
```

## Quick Start

```bash
pnpm exec quality-tools organize .
pnpm exec quality-tools boundaries . --strict
pnpm exec quality-tools reachability . --strict
pnpm exec quality-tools scrap ./tests
pnpm exec quality-tools crap ./src
pnpm exec quality-tools mutate .
pnpm exec quality-tools mutate -- --mutate ./src/parser.ts
```

Targets can be the repo root, a package shorthand, a package root, a directory,
or a file. Package shorthand is resolved from workspace package names, not from
hardcoded folder names. The starter config uses `src` as a conventional default,
but the tools scope from the target path plus your configured include/exclude
globs.

## Reports

All quality-tool artifacts use one report root:

```json
{
  "reportsDir": "reports/quality-tools"
}
```

Current outputs:

- `reportsDir/organize/*.json` for organize baselines
- `reportsDir/scrap/*.json` for scrap baselines
- `reportsDir/crap/<target>/coverage-final.json` for CRAP coverage input
- `reportsDir/mutation/mutation.json` and `mutation.html` from Stryker
- `reportsDir/mutation/<target>/mutation.json` copied per mutation target

CRAP reads the coverage report path you configure. The starter Vitest command
writes that coverage under `reportsDir/crap/<target>/`.

## Config

Run `quality-tools init` to create a starter `quality.config.json`.

```json
{
  "reportsDir": "reports/quality-tools",
  "defaults": {
    "crap": {
      "coverage": {
        "command": "pnpm",
        "args": [
          "exec",
          "vitest",
          "run",
          "--coverage",
          "--coverage.reportsDirectory",
          "{repoRoot}/{reportsDir}/crap/{reportKey}"
        ],
        "coveragePath": "{repoRoot}/{reportsDir}/crap/{reportKey}/coverage-final.json"
      },
      "exclude": ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"]
    },
    "mutation": {
      "include": ["src/**/*.ts", "src/**/*.tsx"],
      "exclude": ["src/**/*.d.ts"]
    },
    "scrap": {
      "include": ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
      "exclude": []
    },
    "boundaries": {
      "include": ["src/**/*.ts", "src/**/*.tsx"],
      "exclude": ["src/**/*.d.ts", "**/*.test.ts", "**/*.test.tsx"],
      "entrypoints": [],
      "layers": []
    },
    "organize": {
      "lowInfoNames": {
        "banned": ["utils", "helpers", "misc", "common", "shared", "_shared", "lib", "index"],
        "discouraged": ["types", "constants", "config", "base", "core"]
      }
    }
  },
  "packages": {}
}
```

Package-specific config lives under `packages.<packageName>`. The package name
is the unscoped manifest name by default, so `@scope/parser` is configured as
`parser`.

## CRAP

CRAP calculates complexity plus coverage risk and fails when a function exceeds
the threshold. The default threshold is `8`.

```bash
pnpm exec quality-tools crap ./src
pnpm exec quality-tools crap parser --threshold 10
```

CRAP needs Istanbul `coverage-final.json`. Configure the command and report path
for your project. Put generated coverage under `{reportsDir}` when possible so
all artifacts stay together:

```json
{
  "defaults": {
    "crap": {
        "coverage": {
          "command": "pnpm",
          "args": [
            "exec",
            "vitest",
            "run",
            "--coverage",
            "--coverage.reportsDirectory",
            "{repoRoot}/{reportsDir}/crap/{reportKey}"
          ],
          "coveragePath": "{repoRoot}/{reportsDir}/crap/{reportKey}/coverage-final.json"
        }
      }
    },
  "packages": {
    "parser": {
      "crap": {
        "coverage": {
          "command": "pnpm",
          "args": [
            "--filter",
            "{packageJsonName}",
            "exec",
            "vitest",
            "run",
            "--coverage",
            "--coverage.reportsDirectory",
            "{repoRoot}/{reportsDir}/crap/{reportKey}"
          ],
          "coveragePath": "{repoRoot}/{reportsDir}/crap/{reportKey}/coverage-final.json"
        }
      }
    }
  }
}
```

Supported template values in CRAP coverage command fields:

- `{repoRoot}`
- `{packageRoot}`
- `{packageName}`
- `{packageJsonName}`
- `{reportKey}`
- `{target}` or `{targetPath}`
- `{reportsDir}`

## Mutation

Mutation runs Stryker against the selected source target. The CLI does not run
typecheck first and does not assume any package is special.

```bash
pnpm exec quality-tools mutate .
pnpm exec quality-tools mutate parser
pnpm exec quality-tools mutate -- --mutate ./src/parser.ts
```

The CLI passes Stryker:

- the Stryker config path
- scoped mutate globs from `quality.config.json`
- an incremental file path under `reportsDir/mutation/<target>/`
- `QUALITY_TOOLS_REPORTS_DIR`, so the bundled base config writes to the shared
  report root

Use a project Stryker config when you need custom Vitest wiring:

```js
const base = require('@poleski/quality-tools/stryker.config.cjs');

module.exports = {
  ...base,
  vitest: {
    ...base.vitest,
    configFile: 'vitest.config.ts'
  }
};
```

Then reference it in `quality.config.json`:

```json
{
  "defaults": {
    "mutation": {
      "strykerConfig": "stryker.config.cjs",
      "include": ["src/**/*.ts", "src/**/*.tsx"],
      "exclude": ["src/**/*.d.ts"]
    }
  }
}
```

If `strykerConfig` is omitted, the tool looks for `stryker.config.cjs`,
`stryker.config.mjs`, `stryker.config.js`, or `stryker.conf.js` in the repo
root, then falls back to the bundled base config.

## Other Tools

```bash
pnpm exec quality-tools organize ./src
pnpm exec quality-tools boundaries parser --strict
pnpm exec quality-tools reachability parser --strict
pnpm exec quality-tools scrap ./tests --strict
```

- `organize` checks directory size, depth, naming, barrels, and cohesion. Use
  `--write-baseline` and `--compare <path>` for baseline workflows.
- `boundaries` checks configured layers, entrypoints, dead surfaces, and dead
  ends.
- `reachability` reports dead surfaces and dead ends without boundary-layer
  failures.
- `scrap` reviews test files for split pressure, repeated setup, weak
  assertions, validation issues, and refactor recommendations.

## Development

```bash
pnpm run test
pnpm run lint
pnpm run typecheck
pnpm run build
```
