---
name: design-md-cli
description: >-
  Complete reference skill for the design.md CLI and @google/design.md library.
  Use when linting, exporting, diffing, or inspecting DESIGN.md files programmatically
  or via the CLI. Covers all commands, output shapes, error handling, and agent-specific
  guardrails.
---

# design.md CLI — Agent Skill

## Installation

```bash
npm install -g @google/design.md   # global CLI
npm install @google/design.md      # library
```

On Windows, always use `designmd` instead of `design.md` to avoid the `.md` file association conflict in PowerShell.

---

## Commands

### `lint <file>`

Validates a DESIGN.md file against all active rules.

```bash
designmd lint DESIGN.md
designmd lint DESIGN.md --format json   # default
designmd lint - < DESIGN.md             # stdin
```

**Output shape** (`--format json`):
```json
{
  "findings": [
    {
      "rule": "unknown-key",
      "severity": "warning",
      "message": "Unknown key 'colour' — did you mean 'colors'?",
      "path": "colour"
    }
  ],
  "summary": { "errors": 0, "warnings": 1, "infos": 0 }
}
```

**Exit codes:** `0` = no errors, `1` = errors found, `2` = file read error.

**Agent guardrails:**
- Always check `summary.errors === 0` before treating the file as valid.
- `findings` may be empty even when exit code is `0` — that means the file is clean.
- Do NOT parse the `--format text` output. It is for humans only.

---

### `export <file> --format <fmt>`

Exports design tokens to another format.

```bash
designmd export DESIGN.md --format css-tailwind   # Tailwind v4 @theme CSS
designmd export DESIGN.md --format json-tailwind  # Tailwind v3 theme.extend JSON
designmd export DESIGN.md --format tailwind       # alias for json-tailwind
designmd export DESIGN.md --format dtcg           # W3C DTCG JSON
designmd export - --format css-tailwind < DESIGN.md  # stdin
```

**`css-tailwind` output** (stdout, plain text):
```css
@theme {
  --color-primary: #0000ff;
  --color-secondary: #ff0000;
  --font-body: "Inter", sans-serif;
}
```

**`json-tailwind` output** (stdout, JSON):
```json
{
  "colors": { "primary": "#0000ff", "secondary": "#ff0000" },
  "fontFamily": { "body": ["Inter", "sans-serif"] }
}
```

**`dtcg` output** (stdout, JSON): W3C Design Token Community Group format.

**Error output** (stderr, JSON):
```json
{ "error": "Export failed: no colors defined in design system" }
```

**Agent guardrails:**
- `css-tailwind` output is CSS text, not JSON. Write it directly to a `.css` file.
- Always run `lint` before `export`. Export succeeds even with warnings, but not with errors that corrupt the token model.
- Exit code `1` = either lint errors OR export failure.

---

### `diff <before> <after>`

Compares two DESIGN.md files and returns added, removed, and modified token keys.

```bash
designmd diff old/DESIGN.md new/DESIGN.md
designmd diff old/DESIGN.md new/DESIGN.md --format json
```

**Output shape** (`--format json`):
```json
{
  "summary": "3 added, 1 removed, 2 modified",
  "added": ["colors.success"],
  "removed": ["colors.error"],
  "modified": ["colors.primary", "typography.body"]
}
```

---

### `spec [--format json] [--rules] [--rules-only]`

Outputs the DESIGN.md format specification and/or the active lint rules.

```bash
designmd spec                          # full spec as Markdown
designmd spec --format json            # spec as JSON
designmd spec --rules-only --format json  # just the rules as JSON
designmd spec --rules                  # spec + rules appended
```

**`--rules-only --format json` output shape:**
```json
{
  "rules": [
    { "name": "unknown-key", "severity": "warning", "description": "..." },
    { "name": "token-like-ignored", "severity": "warning", "description": "..." }
  ]
}
```

**Agent guardrails:**
- Use `--rules-only --format json` when you need to know what rules exist programmatically.
- Do not parse `--format markdown` output to extract rules — use JSON.

---

## Programmatic API

```typescript
import { lint, serializeTailwindV4 } from '@google/design.md/linter';

const report = lint(markdownString);

// Always check for errors first
if (report.summary.errors > 0) {
  console.error('Lint errors:', report.findings.filter(f => f.severity === 'error'));
}

// Tailwind v4 CSS
if (report.tailwindV4Config.success) {
  const css = serializeTailwindV4(report.tailwindV4Config.data.theme);
  // css = '@theme { --color-primary: #0000ff; ... }'
}

// Tailwind v3 JSON
if (report.tailwindConfig.success) {
  const theme = report.tailwindConfig.data;
  // theme = { colors: { primary: '#0000ff' }, ... }
}
```

### `LintReport` shape

```typescript
interface LintReport {
  designSystem: DesignSystemState;   // full parsed model (Map-based)
  findings: LintFinding[];           // all rule findings
  summary: { errors: number; warnings: number; infos: number; };
  tailwindConfig: TailwindResult;    // v3 Tailwind theme.extend
  tailwindV4Config: TailwindV4Result; // v4 @theme CSS data
}

// Discriminated union — always narrow before reading .data
type TailwindV4Result =
  | { success: true;  data: { theme: TailwindV4Theme } }
  | { success: false; error: { message: string } };
```

---

## DESIGN.md Format Quick Reference

```yaml
---
name: My Design System
colors:
  primary: "#0000ff"
  secondary: oklch(70% 0.2 250)
typography:
  body:
    family: "Inter", sans-serif
    size: 16px
    weight: 400
spacing:
  sm: 4px
  md: 8px
  lg: 16px
effects:
  shadow-sm: "0 1px 2px rgba(0,0,0,0.05)"
---

# Design System Documentation

(Optional Markdown body — ignored by the linter)
```

**Supported color formats:** hex (`#fff`, `#ffffff`, `#ffffff80`), `rgb()`, `hsl()`, `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`, named CSS colors, `color-mix()`.

---

## Common Pitfalls

- **`color` vs `colors`:** The key is `colors` (plural). The `unknown-key` rule will warn about `colour` or `color` as a likely typo.
- **Nested token maps are silently dropped** unless they follow the recognized schema. The `token-like-ignored` rule warns when a top-level key looks like a token map but isn't part of the schema.
- **Don't invent top-level keys** beyond `name`, `colors`, `typography`, `spacing`, `effects`. Other keys are extension points but will not be exported.
- **`tailwindV4Config` can fail even with zero lint errors** — e.g. if no tokens are defined at all. Always check `.success`.
