---
loop-type: code
---

# Issue template — loop type: `code`

**Used by:** `/create-issue --type=code` (default).

**When:** software implementation tasks — feature, bug fix, refactor, dependency update.

**Deliverable:** PR with code diff + tests, merged to `pr_base` from AGENTS.md.

**Implementer brief:** `skills/work-issue/references/subagent-briefs/code-implementer.md`

---

## Rendered body schema (placeholders with `{{...}}`)

This template is rendered by the skill body (spec dialog). Placeholders are substituted at render time. Required sections are exactly these, in this order — `/work-issue`'s Validator checks them strictly.

```markdown
## Idea (Why)

{{idea}}

## Spec (What)

{{spec}}

**Estimate:** {{estimate_half_days}} half-day(s)

## Acceptance Criteria

### from AGENTS.md `ac_templates` (required)
{{ac_templates_block}}

### Hard-Gates
{{hard_gates_block}}

### Issue-specific
{{user_ac_block}}

## Files to Touch

{{files_to_touch_block}}

## Test Plan

{{test_plan}}

## Dependencies / Blocks

{{dependencies_block}}

## Out of Scope

{{out_of_scope_block}}

## Standards Override (optional)

{{standards_override_block}}

## Standards Notes

{{standards_notes_block}}
```

---

## Section details

### `## Idea (Why)`

Strategic context, user pain, outcome. 1-3 paragraphs. Loaded into the Validator briefing.

### `## Spec (What)`

Technical spec, architecture, affected components. Sub-headers (`###`) allowed. Carries the `**Estimate:**` line (dialog question 12, mandatory, refused above the cap — canonical: `skills/create-issue/SKILL.md`, "Effort estimate (half-days) and the four-half-day cap"; design rationale: `docs/adr/0026-issue-scope-discipline.md`; not restated here).

### `## Acceptance Criteria`

Three (or four) sub-blocks:
1. **`### from AGENTS.md ac_templates (required)`** — auto-injected from AGENTS.md (mode 1) or override list (mode 3) or empty (mode 2). See `skills/create-issue/SKILL.md` section "Auto-injection".
2. **`### Hard-Gates`** — `hard_gates` from AGENTS.md (only if not disabled by an issue standards override).
3. **`### Component Reuse Check`** *(optional)* — auto-injected when AGENTS.md has a `components:` block AND the issue lands in registry scope. See `skills/create-issue/SKILL.md` section "Component Reuse Check". The Validator expects the issue to either name an existing registry component OR link an ADR path in the `## Standards Override` block (STOP under `usage_policy: strict`, warn under `prefer_existing`).
4. **`### Issue-specific`** — user ACs from the spec dialog plus type-detection trigger ACs.

Every checkbox: `- [ ] <concrete, testable>`.

### `## Files to Touch`

List with path annotation. Example:

```
- `path/a.ts` — what happens there
- `path/b.ts` — what happens there
```

Sub-headers `### NEW` / `### Changed` allowed for clarity.

### `## Test Plan`

Which smoke tests, which build command, what proves success. Should reflect `smoke_test` from AGENTS.md.

For every test the issue adds or changes, name **which command runs it and in which environment** — one of three forms: run in CI and locally, run locally only (not in CI — legal, and worth stating), or manual-only with steps. The Validator gate checks this; the verbatim form of each and the no-op `smoke_test` degradation are canonical in `skills/work-issue/SKILL.md`, Stage 1 briefing, gate "Test plan present, and names the execution path per new or changed test" — do not restate the exact wording here, point at it.

### `## Dependencies / Blocks`

```
- depends on #<X>
- blocks #<Y>
```

### `## Out of Scope`

At minimum `default_oos` from AGENTS.md plus issue-specific.

### `## Standards Override` (optional)

Only insert if the issue diverges from AGENTS.md. YAML block:

```yaml
work-issue:
  syntax_check: "<custom>"
  smoke_test: "<custom>"
```

### `## Standards Notes`

Optional. Reasoning for `DISMISS` on type-detection triggers or `ac_templates` overrides. Read in the Critic briefing.

---

## Issue labels (auto-set)

- `loop-type:code` — required; `/work-issue` uses it to pick the subagent brief.
- `area:<name>` — set from spec-dialog question 8 unless the user skips it. Contract (grammar, lifetime, sources) canonical in `skills/plan-issues/SKILL.md`, section "Label contract — `area:` and `bundle:` (canonical)".
- `bundle:<name>` — **not** set at creation. Only `/plan-issues` writes it, and only from a source that already exists.
- `found-in-loop` — set only when this issue was created via `--from-loop <issue>`. Contract canonical in `skills/plan-issues/SKILL.md`, section "Label contract — `found-in-loop`".
- `enhancement` / `bug` / `refactor` — per trigger detection (see the skill body).
- Additional labels from type-detection triggers (#1-#6) — see `skills/create-issue/SKILL.md`.

---

## Example (rendered)

```markdown
## Idea (Why)

A `--since` filter for a changelog CLI: the user runs `changelog --since v1.2`
and gets only the entries added after that tag, instead of the whole history.

## Spec (What)

The argument parser gains a `--since <tag>` option. The CLI resolves the tag to
a commit, keeps only the commits after it, and renders them with the existing
formatter. An unknown tag exits non-zero with a message naming the tag.

**Estimate:** 1 half-day(s)

## Acceptance Criteria

### from AGENTS.md `ac_templates` (required)
- [ ] Code passes `node --check`
- [ ] Documentation in README/CLAUDE.md updated
- [ ] No new secrets in repo (secret check passed)

### Hard-Gates
- [ ] No direct edits on main
- [ ] Every CLI option is listed in `--help`

### Issue-specific
- [ ] `--since v1.2` lists only commits after `v1.2`
- [ ] `--since no-such-tag` exits 1 and names the tag

## Files to Touch

- `src/cli.ts` — `--since` option
- `src/git/range.ts` — tag-to-commit resolution and filtering

## Test Plan

`npm test`, then in a fixture repo with tags `v1.1` and `v1.2`:
`node dist/cli.js --since v1.2` — only the commits after `v1.2` appear.

## Dependencies / Blocks

- depends on #42
- blocks #51

## Out of Scope

- Date-based ranges (`--since 2026-01-01`)
- Output formats other than Markdown
```
