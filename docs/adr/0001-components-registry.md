# ADR-0001: Optional Component Registry in AGENTS.md

## Status

Accepted.

## Context

Component drift across sessions and users is a real, recurring cost. The same UI concept (a data table, a navigation menu, a modal) gets re-implemented slightly differently every time an issue lands. When a decision changes ("from now on: tabs, not submenus"), a 20-file refactor becomes the cheapest exit — because there was never one canonical component to change.

The same trap exists on the backend: domain entities, value objects and query handlers get re-derived from DTOs on the boundary, subtly diverging every time, until "the same thing" is implemented in three places with three subtly different invariants.

The loop-workflow workflow can prevent this by treating a repo's Component Registry as a hard-gate: a single implementation carries a `variant` prop (or a discriminated feature flag) for the code layer, plus a Markdown catalog that names the components and their usage rules and backend contract shape. Reused across issues, enforced across sessions, honored by the Validator / Implementer / Critic stages.

The gate has to be **opt-in** — repos without reusable-component patterns (docs-only, single-script, thin CLI wrappers) should not pay any enforcement cost. Zero behavior change when the block is absent.

## Decision

Introduce an optional `components:` block in `AGENTS.md` YAML frontmatter with two layers:

1. **Code layer** — the real reusable components in the codebase, single source of truth for API / props / types / backend contract. Referenced via `code_globs`.
2. **Markdown catalog layer** — a per-component MD (at `registry_path`) describing when to use, when not to, where the code lives, the public API summary, the backend contract shape (if applicable), and the anti-patterns.

### Schema

```yaml
components:
  registry_path: "docs/components.md"           # required if block present
  code_globs:                                   # required — the code source-of-truth
    - "src/components/**/*.tsx"
    - "src/domain/**/*.ts"
  usage_policy: "prefer_existing"               # prefer_existing (soft) | strict (hard, ADR required)
  scope: "both"                                 # frontend | backend | both (default both)
```

Absent block → zero behavior change. Pure-Reader principle.

### Enforcement design

- **Validator (stage 1)** — if the issue's Spec or Files-to-Touch overlaps `code_globs` (filtered by `scope`), gate the issue:
  - `prefer_existing` — WARN if no registry component is referenced / no ADR is linked; loop continues.
  - `strict` — STOP unless an existing registry component is referenced OR an ADR path is linked in the issue's `## Standards Override` block.
- **Implementer brief (stage 2)** — hard-gate: "If a registry component fits the case, use it. Do not inline a duplicate. If nothing fits, stop and propose an ADR before implementing."
- **Critic (stage 4)** — dupe-detection pass: `search_code` / grep across `code_globs` for repeated patterns similar to what the diff introduces; if two implementations cover the same concept, raise a REVISE item quoting both code paths. Runs regardless of `usage_policy`.

### Bootstrap by `/init-agents`

`/init-agents` probes the target repo for component-pattern signals (frontend framework files: `.tsx`/`.jsx`/`.vue`/`.svelte`; backend domain layer: `src/domain/**`, `src/entities/**`, `src/aggregates/**`). If any signal fires, the skill proposes a `components:` block with sensible defaults (seeded `code_globs`, `usage_policy: prefer_existing`, matching `scope`) and offers to copy the template MD from `skills/init-agents/references/components-registry-template.md` into the resolved `registry_path`. If no signal fires, the block is skipped silently.

### Version bump

`minor` per `version_policy` — new AGENTS.md field with a safe default (absent = zero behavior change), backwards-compatible for existing AGENTS.md files.

## Alternatives considered

### Alternative A — Verbatim-Markdown-only (no code anchor)

Just a per-repo `docs/components.md` file, no `code_globs`, no code source-of-truth anchor.

- **Pros:** simplest to bootstrap; no glob complexity; works even for repos without a code layer.
- **Cons:** the catalog inevitably drifts from the code; the Critic cannot dupe-detect (no code globs to grep); the Validator has no way to check "does the referenced component actually exist"; the loop degrades into documentation theater within weeks.

Rejected — the whole point is enforced reuse, not a static catalog.

### Alternative B — Code-anchor only (no Markdown catalog)

Just `code_globs` in AGENTS.md, no per-component MD.

- **Pros:** minimal file surface; the code is the truth; no separate document to maintain.
- **Cons:** no place for "when NOT to use" guidance, anti-patterns, backend contract shape, or the reasoning that separates "canonical" components from "internal helpers"; issue-authoring loses the shorthand "reuse `DataTable`" reference; the Validator has to inspect code to decide reuse-fit at issue time.

Rejected — the Markdown catalog is where the usage policy and the backend contract shape live. Removing it forces the same discussion into every issue.

### Alternative C — Storybook-style live docs generation

Rely on a Storybook / Ladle / Histoire setup as the registry.

- **Pros:** live examples, visual proof; the catalog is inherently maintained; well-understood tooling in the frontend world.
- **Cons:** tooling-heavy and frontend-only (no backend value-object equivalent); adds a build step; ties the registry to a specific framework version; the loop cannot easily grep Storybook stories the way it can grep the code layer; the enforcement gates would depend on a live server or build artifact instead of a static parse.

Rejected as the default; can co-exist for teams that already run Storybook (the `registry_path` MD can link to Storybook stories), but is not the primitive.

## Consequences

### Immediate

- New AGENTS.md field, opt-in, backwards-compatible. `minor` version bump.
- `/init-agents` gains a component-pattern probe and a proposal step for the block.
- `/create-issue` injects a "Component Reuse Check" AC block when the issue lands in registry scope.
- `/work-issue` propagates the block through the state tracker and enforces the gate at three stages (Validator / Implementer / Critic).
- A new template file (`skills/init-agents/references/components-registry-template.md`) with a worked frontend and a worked backend example.
- This ADR.

### Loop cost

- Per-loop token overhead for the enforcement is small: the Validator adds one gate check (grep the issue text + files-to-touch against `code_globs`), the Critic adds one `search_code` pass over `code_globs`. In repos without the block, zero overhead.
- The Implementer gains one hard constraint; no additional runtime.

### Follow-ups (out of scope for this ADR)

- Automated registry extraction from code: a future `/init-agents --refresh --extract-components` mode could parse the `code_globs` and seed the registry MD from actual component declarations (props, types).
- Multi-language registry MDs (English-only per language policy — not planned).
- Retro-active registry bootstrap for existing large repos beyond the battle-test run.

## Battle-test observations

The end-to-end battle-test on an external repo with real component patterns is executed as a follow-up run to this loop. Target-repo identifier and observations land here:

- **Target repo identifier:** _TBD after battle-test run_
- **Loop-friction observations:** _TBD after battle-test run_
  - Token cost of the enforcement gates (Validator gate, Critic dupe-detection pass): _TBD_
  - False-positive rate of the Validator scope trigger (issues flagged in-scope that were actually orthogonal): _TBD_
  - False-positive rate of the Critic dupe-detection (patterns flagged as dupes that were legitimately parallel): _TBD_
  - `usage_policy: prefer_existing` vs `strict` mode differences observed in practice: _TBD_
