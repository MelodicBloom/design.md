# design.md — Agent Context

This file is loaded automatically by GitHub Copilot, Cursor, Windsurf, Claude Code, and any agent that checks for `AGENTS.md` at the repository root.

## What this repo is

`design.md` is an agent-first CLI and library for the DESIGN.md format — a Markdown file with YAML frontmatter that encodes a design system (colors, typography, spacing, effects) in a single human-readable file. The CLI lints, exports, and diffs DESIGN.md files. The library (`@google/design.md/linter`) exposes the same logic for programmatic use.

**Package:** `@google/design.md` on npm  
**Binary:** `designmd` (Windows-safe) or `design.md`  
**Linter sub-path:** `@google/design.md/linter`

---

## Skill Library

Load these skills for specific tasks:

| Skill | Path | Use when |
|---|---|---|
| `design-md-cli` | `.agents/skills/design-md-cli/SKILL.md` | Using the CLI or library |
| `tdd-red-green-refactor` | `.agents/skills/tdd/SKILL.md` | Writing new features or fixing bugs |
| `typed-service-contracts` | `.agents/skills/typed-service-contracts/SKILL.md` | Adding commands, handlers, or specs |
| `agent-dx-cli-scale` | `.agents/skills/agent-dx-cli-scale/SKILL.md` | Evaluating or improving agent DX |
| `ink` | `.agents/skills/ink/SKILL.md` | Building terminal UI with `@json-render/ink` |

---

## Architecture

```
packages/cli/src/
  index.ts              — CLI entry point (citty)
  commands/
    lint.ts             — design.md lint <file>
    export.ts           — design.md export <file> --format <fmt>
    diff.ts             — design.md diff <before> <after>
    spec.ts             — design.md spec [--format json] [--rules]
  linter/
    index.ts            — Public API: lint(), serializeTailwindV4()
    linter/             — Rule engine + rule implementations
    parser/             — YAML frontmatter parser → ParsedDesignSystem
    model/              — ParsedDesignSystem → DesignSystemState
    tailwind/           — Tailwind v3 theme.extend generator
    tailwindV4/         — Tailwind v4 @theme CSS generator
    dtcg/               — W3C DTCG token emitter
  utils.ts              — readInput(), formatOutput(), diffMaps()
  version.ts            — VERSION constant
```

---

## Key Invariants

### Always use `--format json` (or default) for machine consumption
The CLI defaults to JSON output. Never parse the human-readable text format programmatically.

### `lint()` return shape — always check `summary.errors` before acting
```typescript
interface LintReport {
  designSystem: DesignSystemState;   // parsed model
  findings: LintFinding[];           // all rule findings
  summary: { errors: number; warnings: number; infos: number; };
  tailwindConfig: Result<TailwindTheme>;     // v3 theme.extend
  tailwindV4Config: Result<TailwindV4Theme>; // v4 @theme CSS
}
// Result<T> is a discriminated union:
// { success: true; data: T } | { success: false; error: { message: string } }
```

**Always check `result.tailwindV4Config.success` before reading `.data`.**  
The v4 result fails if the design system has errors that prevent CSS generation.

### Export formats
| Format | Output |
|---|---|
| `css-tailwind` | Tailwind v4 `@theme { ... }` CSS block |
| `json-tailwind` / `tailwind` | Tailwind v3 `theme.extend` JSON |
| `dtcg` | W3C Design Token Community Group JSON |

### stdin
All file-taking commands accept `-` as the file path to read from stdin:
```bash
cat DESIGN.md | designmd lint -
cat DESIGN.md | designmd export - --format css-tailwind
```

### Windows
Use `designmd` (not `design.md`) on Windows. The `.md` extension conflicts with the Markdown file association in PowerShell.

### Error output
All errors are JSON objects on stderr:
```json
{ "error": "FILE_READ_ERROR", "message": "...", "path": "..." }
```
Exit code `1` = lint errors found. Exit code `2` = file read error.

---

## Monorepo Layout

```
packages/cli/           — @google/design.md (the only published package)
docs/                   — Spec source (spec.md, spec.mdx)
examples/               — Example DESIGN.md files
.github/
  workflows/            — CI: test.yml, publish.yml, release-drafter.yml, codeql.yml
  scripts/sync-labels.ts — Creates all required GitHub labels
  release-drafter.yml   — Release notes config
  labeler.yml           — Auto-label PRs by CC type
```

**Package manager:** Bun 1.3.9 (`bun install`, `bun test`, `bun run build`)  
**Task runner:** Turborepo (`turbo build`, `turbo test`, `turbo lint`)

---

## Conventional Commits

All commits and PR titles must follow conventional commits:
`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `perf:`, `test:`, `ci:`, `build:`, `release:`

Scoped form is fine: `feat(linter):`, `fix(cli):`, `fix(model):`  
Breaking changes use `!`: `feat!:`, `fix(parser)!:`

PR titles are validated by the `PR Title` workflow and auto-labeled for release-drafter.

---

## Common Tasks

### Add a new lint rule
1. Create `packages/cli/src/linter/linter/rules/<rule-name>.ts` following the `typed-service-contracts` skill
2. Register it in `packages/cli/src/linter/linter/rules/index.ts` in `DEFAULT_RULE_DESCRIPTORS`
3. Update the count assertions in `types.test.ts` and `spec.test.ts`
4. Re-export from the public API in `packages/cli/src/linter/index.ts`

### Add a new export format
1. Add the format string to the `FORMATS` const in `commands/export.ts`
2. Add a handler under `packages/cli/src/linter/<format>/handler.ts` following the Spec & Handler pattern
3. Wire it into the `export` command run function
4. Add a smoke test in `check-package.ts` phase 4

### Run everything locally
```bash
bun install
bun run build    # turbo build
bun run test     # turbo test  
bun run lint     # turbo lint (tsc --noEmit)
bun run check-package  # from packages/cli/
```
