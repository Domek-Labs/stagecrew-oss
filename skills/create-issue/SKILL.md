---
name: create-issue
description: "Create a GitHub issue from a feature request or idea, with a full spec standard (Idea/Spec/AC/Files-To-Touch/Test-Plan/Out-of-Scope). Multi-repo. AGENTS.md in the repo overrides default templates. --type=<code|research> flag plus auto-inference. Auto-injection of AGENTS.md ac_templates into the AC block plus issue-type detection. Injects the strategic gate ACs where the repo declares strategy.gates (canonical home of the ADR Check and the Documentation Check). Codebase-memory auto-suggests files-to-touch and hotspots. Sets the area: subject label on creation, plus the feature: axis label where the repo declares strategy.feature_axis. Requires a half-day estimate (refuses above four) and a dated milestone (due_on) for any stretch of work. --from-loop <issue> redirects a loop finding into its own issue, setting found-in-loop and hard-suppressing the auto-handoff question. Optional auto-handoff to /work-issue otherwise. Triggers: /create-issue, create issue, new issue, file issue, file feature, spec issue, idea as ticket."
---

# /create-issue — Idea → specified GitHub issue

**Type:** issue genesis / spec engineering

## Purpose

Issue-genesis phase. A user idea becomes a fully-specified GitHub issue that `/work-issue` can pick up directly. The skill ensures every issue has Idea + Spec + AC + Files + Test-Plan + OoS before any code gets written.

The spec standard matches what `/work-issue`'s Validator expects as a GO criterion — so no Validator STOPs on the first loop pass.

## Invocation variants

```
/create-issue "a --since filter for the changelog CLI"
/create-issue --type=research "benchmark ollama tool-use"
/create-issue --repo your-org/your-repo "improve scheduler"
/create-issue                                  # → asks for idea + repo
/create-issue --refine <num> [--repo <slug>]   # → extend an existing issue with spec fields
/create-issue --from-loop <issue> "tighten the retry backoff"   # redirect a loop finding — see "Loop-finding redirect"
```

**Argument parsing:** same as `/work-issue` (GitHub syntax, `--repo` flag, cwd fallback).

**`--from-loop <issue>` flag:** marks the new issue as a redirected loop finding rather than work planned from scratch — sets `found-in-loop` and hard-suppresses step h)'s auto-handoff question. See "Loop-finding redirect" below; not restated here.

**`--type=<code|research>` flag:** selects the issue template from
`references/issue-templates/<type>.md`. If not set: auto-inference from
user text (see the next section).

## Loop-type resolution

In this order:

1. **Explicit flag** — `--type=<code|research>`
2. **Auto-inference from user text** (keyword heuristic)
3. **AGENTS.md `loop_types.default`** (fallback, typically `code`)
4. **Ambiguous input:** the skill asks explicitly "code loop or research loop?"

### Auto-inference keywords

| Keywords in user text | Inferred type |
|-----------------------|---------------|
| "feat", "feature", "fix", "bug", "refactor", "implement", "add X", "build X" | `code` |
| "research", "investigate", "benchmark", "compare", "debug X (root-cause unclear)", "explore", "evaluate" | `research` |

If code and research score the same → ask explicitly.

### Supported types

The skill reads `AGENTS.md` `loop_types.enabled`. Currently only `code` and `research`
are implemented. On `--type=text|decision|diagnostic`:

```
Error: loop-type '<type>' is not implemented.
Roadmap issues:
  - Text loop:       <repo>/issues?label=loop-type,roadmap,text
  - Decision loop:   <repo>/issues?label=loop-type,roadmap,decision
  - Diagnostic loop: <repo>/issues?label=loop-type,roadmap,diagnostic
Use --type=code or --type=research, or file a new issue
for the type-roadmap proposal.
```

### Template loader

The skill loads `skills/create-issue/references/issue-templates/<type>.md`. The
template's frontmatter is read (`loop-type: <type>`); the body is used as the render
schema. Required sections + placeholders define the spec-dialog fields.

### Issue-label setting

On `gh issue create`, the labels `loop-type:<type>` and `area:<name>` are set (in addition to trigger-detection labels).

If a label does not yet exist in the repo, create it first:

```bash
gh label create "loop-type:code" --repo <slug> --color 0E8A16 --description "Software implementation loop" --force
gh label create "loop-type:research" --repo <slug> --color 5319E7 --description "Research/findings loop" --force
gh label create "area:<name>" --repo <slug> --color 1D76DB --description "Subject area" --force
gh label create "goal:<value>" --repo <slug> --color C5DEF5 --description "Goal axis" --force      # only when plan-issues.goals is declared
gh label create "feature:<name>" --repo <slug> --color 0052CC --description "Feature axis" --force # only when strategy.feature_axis is declared
gh label create "found-in-loop" --repo <slug> --color 5319E7 --description "Redirected from a loop finding, not planned from scratch" --force # only when --from-loop is passed
```

`area:` is answered in the spec dialog (question 8) — see "Area label (`area:`)" below. `goal:<value>` is set only when AGENTS.md declares `plan-issues.goals` (spec-dialog question 9) — see "Goal label (`goal:`)" below; the prefix resolves against `goal_prefix` (default `goal:`). `feature:<name>` is set only when AGENTS.md declares `strategy.feature_axis` (spec-dialog question 10) — see "Feature label (`feature:`)" below; the prefix resolves against `strategy.feature_axis.prefix` (default `feature:`), so the label name in the `gh label create` call is built from the resolved prefix, never from the literal string. `found-in-loop` is set only when this run was invoked with `--from-loop <issue>` — see "Loop-finding redirect" below; unlike the three above it has no configurable prefix. `bundle:` is **not** set here: a bundle is a release decision that rarely exists at creation time, and `/create-issue` never invents one.

## Workflow

### a) Repo resolution

Same as `/work-issue`:
1. GitHub syntax `<owner>/<repo>` OR `--repo` flag
2. cwd fallback via `git remote get-url origin`
3. If unclear: ask

### b) AGENTS.md pre-step

**Before anything else:** AGENTS.md existence check at the repo root.

- `ls <repo_path>/AGENTS.md` → exists? → proceed to (c).
- Missing → call `/init-agents --repo <slug> --interactive`, then return to (b) — re-check.

Background: `/work-issue` is a pure-reader and needs AGENTS.md. `/create-issue` builds on this — `ac_templates` and `default_oos` from AGENTS.md are suggested as defaults in the spec dialog.

### c) codebase-memory pre-flight

Same block as `/work-issue`:
1. `list_projects` — check whether `<repo>` is indexed
2. If not: `index_repository` (mode `moderate`)
3. If indexed: `index_status` — freshness check (>7 days AND a newer commit → re-index)
4. Health check: `nodes < 200` OR `source_files < 3` → warn "default heuristic may have excluded dirs"

### d) AGENTS.md read

Read at the repo root (guaranteed to exist after step b). Load the frontmatter for `ac_templates`, `default_oos`, `loop_types` — these are suggested as defaults in the spec dialog. Load the optional `plan-issues:`, `strategy.feature_axis` and `strategy.gates` blocks in the same pass: the first two decide whether the two conditional questions (9 goal, 10 feature) are asked at all, and `strategy.gates` decides which gate AC sub-blocks are injected (see "Strategic Gates" below). None of them is mandatory, and a missing block is never an error here.

### d2) Loop-type resolution

Before the spec dialog, resolve the loop type (see the "Loop-type resolution" section above):

1. Check explicit `--type=<X>` flag.
2. Otherwise auto-inference from the user text.
3. Otherwise `loop_types.default` from AGENTS.md (fallback `code`).
4. If ambiguous: ask explicitly.

Load the template from `skills/create-issue/references/issue-templates/<type>.md`.
The section schema and placeholder list for the spec dialog come from the template body.

### e) Spec dialog (interactive, 10 questions + 2 conditional)

The user is walked through the fields below. On every question the skill is welcome to offer concrete suggestions.

1. **Idea + strategic context (Why)** — what should actually be achieved, what user pain is solved?
2. **Files to touch** — which files will likely be modified?
   - **The skill actively suggests:** extract keywords from the idea (e.g., "scheduler", "changelog", "since") → `search_code` with the keywords → functions + files. `get_architecture` for cluster context. Suggestion: "These files will likely be touched: <list>. Correct?"
   - Flag hotspots in the code graph as diff risks.
3. **Acceptance criteria** as a checkbox list
   - The AGENTS.md `ac_templates` are **injected** (not just suggested) — see the "Auto-injection of AGENTS.md `ac_templates`" section below.
   - The user adds issue-specific ACs, which are appended after the required templates.
   - In addition, issue-type detection (6 triggers) runs before the preview — see the "Issue-type detection" section.
4. **Test plan — what proves it** — for every test the issue proposes to add or change, what is being verified (build command, service restart, manual check).
5. **Test plan — where the proof is produced** — for each test named in question 4, which command runs it and in which environment. The `/work-issue` Validator checks the answer against its own gate; the three legal forms and the no-op `smoke_test` degradation are canonical in `skills/work-issue/SKILL.md`, Stage 1 briefing, gate "Test plan present, and names the execution path per new or changed test" — offer them from there rather than re-deriving them here. Questions 4 and 5 are two prompts over one field: both answers render into the single `{{test_plan}}` placeholder, as one `## Test Plan` section — the split is a dialog-time convenience, not two rendered sections.
6. **Out of scope** — what is explicitly NOT done in this issue?
   - The skill suggests `default_oos` from AGENTS.md (e.g., "multi-user support", "web-channel approvals")
7. **Dependencies** — which issues block this? Which does it block? (`depends on #X`, `blocks #Y`)
8. **Area** — what is this issue about? Sets the `area:<name>` label on creation. See "Area label (`area:`)" below.
9. **Goal** *(conditional — only when AGENTS.md declares `plan-issues.goals`)* — which goal does this serve? Single-select from the declared vocabulary; sets the `goal:<value>` label on creation. Prints the disambiguating check-question. See "Goal label (`goal:`)" below. No `plan-issues.goals` block → this question is not asked and no `goal:` label is set.
10. **Feature** *(conditional — only when AGENTS.md declares `strategy.feature_axis`)* — which building block does this issue build? Free text, with the repo's existing feature labels offered as suggestions; sets the `feature:<name>` label on creation. **Mandatory only for the issue types listed in `require_on`** (default `[enhancement]`); every other type may answer and is never pressed. See "Feature label (`feature:`)" below. No `strategy.feature_axis` block → this question is not asked and no feature label is set.
11. **Milestone + labels** — `gh api repos/<slug>/milestones` → the user picks from open milestones, or explicitly declines a milestone. A milestone without a `due_on` date is refused at selection; declining a milestone altogether is legal only for work that is not a stretch of work. See "Work-stretch end date (`due_on` anchoring)" below — not restated here. Labels free.
12. **Estimate — half-days** — "How many half-days is this?" Mandatory, unconditional; no answer or an answer above the cap refuses creation before the preview. See "Effort estimate (half-days) and the four-half-day cap" below — not restated here.

### f) Issue preview

**Reached only once question 12's estimate has cleared** (an answer of 4 or fewer half-days) — a missing or over-cap estimate refuses before this step, see "Effort estimate (half-days) and the four-half-day cap" below. Render the full issue body. User: APPROVE / REVISE / CANCEL.

### g) Issue create

```
gh issue create --repo <slug> \
  --title "<title>" \
  --body "<rendered-body>" \
  --milestone "<milestone>" \
  --label "loop-type:<type>,area:<name>,<goal-label-if-any>,<feature-label-if-any>,<found-in-loop-if-any>,<other-labels>"
```

The `loop-type:<type>` label is mandatory — `/work-issue` needs it to pick the subagent brief. `area:<name>` is set unless the user skipped question 8. `goal:<value>` is added only when AGENTS.md declares `plan-issues.goals` and the user selected one (question 9). `feature:<name>` is added only when AGENTS.md declares `strategy.feature_axis` and a value was answered (question 10). `found-in-loop` is added only when this run was invoked with `--from-loop <issue>` (see "Loop-finding redirect" below). If a label does not exist yet, run `gh label create` first (see "Issue-label setting" above).

### h) Optional: auto-handoff to /work-issue

**Hard-suppressed when this issue was created via `--from-loop <issue>`.** Not defaulted to No — the question below is not printed at all for such an issue. See "Loop-finding redirect" below. Every other issue reaches this step unchanged.

> Issue #<num> created. Drive it through with `/work-issue` now? (Yes/No)

On yes → forward issue number + repo to `/work-issue`. On no → the issue stays in the backlog.

## Area label (`area:`)

The `area:<name>` label records **what an issue is about** — the one thing a backlog reader needs and neither the title nor `loop-type:` reliably gives. It is set at creation because that is when the answer is cheapest: the person specifying the issue already knows it.

**The contract — grammar, lifetime, who writes and reads the label — is canonical in `skills/plan-issues/SKILL.md`, section "Label contract — `area:` and `bundle:` (canonical)".** Read it there; it is not restated here.

What this skill does with it, in dialog question 8:

- **AGENTS.md declares `plan-issues.areas`** → offer those values as the suggestion list. A value outside the list is still accepted; it is a warning at plan time, never a block, and `/create-issue` does not block on it either.
- **No `plan-issues:` block** → free text, with a one-line note that the value is unvalidated.
- **The user skips the question** → no `area:` label. `/plan-issues` will ask again at its review gate. Never fill the gap by guessing from the title, the idea text or the files-to-touch list.

`--refine` (see "Refine mode") treats a missing `area:` label as one of the gaps it offers to fill.

## Goal label (`goal:`)

The `goal:<value>` label records **what an issue serves** — the one goal that cannot be reached without it. It is one of the two orthogonal issue-label axes; the other, `waiting-on:`, is read by `/work-issue` and is not set here.

**The contract — grammar, cardinality (exactly one goal per issue), the configurable prefix, the work-list-as-a-query, lifetime and label retirement — is canonical in `skills/plan-issues/SKILL.md`, section "Label contract — `goal:` and `waiting-on:` (canonical)".** Read it there; it is not restated here.

What this skill does with it, in dialog question 9 — **only when AGENTS.md declares `plan-issues.goals`**:

- **`plan-issues.goals` declared** → offer the listed goals as a **single-select** (this is not free text — a goal is chosen from the vocabulary, not invented), with `goal_default` offered first when set. Print the disambiguating **check-question**:

  > What happens if we try to reach the goal WITHOUT this issue?

  It separates goal from urgency: if the goal is still reached without this issue, the issue does not belong to that goal. On selection, set the `goal:<value>` label (resolved against the repo's `goal_prefix`, default `goal:`) at creation.
- **No `plan-issues.goals` block** → the question is **not asked** and no `goal:` label is set. Zero new behavior.
- **Optional warning:** if the finished issue would carry a `loop-ready`-style ready marker **and** a `waiting-on:*` label at once, warn — an issue cannot be both ready and blocked. This is a warning, never a block.

## Feature label (`feature:`)

The `feature:<name>` label records **which building block an issue builds** — the third planning axis, beside `area:` (the subsystem an issue is about) and `goal:` (the release target it serves). It is set at creation for the same reason `area:` is: that is when the answer is cheapest, because the person specifying the issue already knows it.

**The contract — grammar against the resolved prefix, cardinality (at most one), lifetime, the legal sources a value may come from, who writes and reads it, and the retirement rule (a superseded feature label is never deleted; checks use `--state all`) — is canonical in `skills/plan-issues/SKILL.md`, section "Label contract — `feature:` (canonical)".** Read it there; it is not restated here. The *switch* that turns the axis on — `strategy.feature_axis` with its `prefix`, `require_on` and `flag_over` — is described in the repo's root `AGENTS.md`, section "Strategic Software Development (optional `strategy:` block)".

What this skill does with it, in dialog question 10 — **only when AGENTS.md declares `strategy.feature_axis`**:

- **No `strategy.feature_axis` block** → the question is **not asked**, no feature label is set and no label is created. Zero new behavior. This is checked before the question is composed, not after.
- **Declared** → resolve the prefix from `strategy.feature_axis.prefix` (default `feature:`) and ask for the feature as **free text** (this is not a single-select: features are many and project-specific, unlike the small `goal:` vocabulary). List the repo's existing feature labels as suggestions, so an issue joins an existing building block rather than inventing a near-duplicate name:

  ```bash
  # the search term is the resolved prefix, not the literal string
  gh label list --repo <slug> --search "feature:" --limit 100 --json name --jq '.[].name'
  ```

  A value outside that list is accepted — the suggestions are the working vocabulary, never a closed set. Validate the answer against the grammar in the canonical contract and re-ask on a mismatch; never silently normalise a value.
- **Mandatory only for the issue types in `require_on`** (default `[enhancement]`). The type is read from the **issue-type labels the issue will carry** — those fired by trigger detection plus any the user has named — matched case-insensitively against the `require_on` entries. `loop-type:<type>` is a different axis and is never matched against `require_on`. An issue whose types are all outside `require_on`, or that carries no type label at all, is asked the question once and may leave it unanswered without any further prompt. Because the free labels are chosen later (question 11), re-check the requirement once before the preview: if a `require_on` type was added there and no feature is set, ask the question then.
- **For a `require_on` type the answer is required before the preview.** The skill does not proceed with an empty value and, above all, does not fill the gap itself: a feature is never inferred from the title, the idea text, the `area:` value or the files-to-touch list. If the user deliberately declines, record the refusal instead of hiding it — append a `## Standards Notes` line to the issue body (`feature axis declined: <reason>`, the same convention a `DISMISS`ed trigger uses) and create the issue without the label. An explicit, visible waiver; never a silent gap, and never a STOP.
- **On an answered value** → create the repository label if it does not exist yet and set it at creation (see "Issue-label setting" above).

`--refine` (see "Refine mode") treats a missing feature label on a repo that has opted in as one of the gaps it offers to fill.

## Loop-finding redirect (`found-in-loop`, `--from-loop`)

`/work-issue` never files an issue for a Critic or Tester finding — it has no issue-creating call in a code loop at all, and the one issue-creating call it does have (a research loop's Closer, filing an optional follow-up implementation issue) is unrelated to this mechanism (see `skills/work-issue/SKILL.md`, "What this skill does NOT do"). A finding stays a REVISE item under the run's own 3-revise cap.

**The leak this mechanism closes sits one step later, not in `/work-issue` itself.** A human sees the REVISE item, runs `/create-issue` for it — cleanly, correctly — and then step h) offers to drive the new issue through `/work-issue` immediately. Saying yes there turns a deliberate redirect of scope back into an appending of scope to the run that just finished, defeating the reason the finding was split out in the first place.

**`--from-loop <issue>`** marks exactly that case: "this issue exists because a `/work-issue` run on `<issue>` surfaced a finding." When the flag is present:

- The new issue gets the `found-in-loop` label at creation (step g). Contract — grammar, cardinality, who writes and reads it, why `/work-issue` never sets it itself — is canonical in `skills/plan-issues/SKILL.md`, "Label contract — `found-in-loop`"; read it there, it is not restated here.
- The originating issue number is recorded in the new issue's `## Standards Notes` block as a plain line: `found-in-loop: originates from #<issue>`.
- **Step h) is hard-suppressed for this issue** — not defaulted to "No": the question "Drive it through with `/work-issue` now?" is not printed at all. See "h) Optional: auto-handoff to /work-issue" above.

**Without the flag, nothing changes.** No label, no body line, and step h) behaves exactly as it did before this section existed.

The redirected issue reappears in the next `/plan-issues` run exactly like any other candidate — no special-casing, see the canonical contract's "Who reads it". Widening the *originating* run's own scope with the finding stays forbidden either way: what is not in that run's own acceptance criteria becomes a new issue, never an addition to the old one.

Design rationale: `docs/adr/0026-issue-scope-discipline.md`.

## Effort estimate (half-days) and the four-half-day cap

**Canonical home.** The half-day unit, the cap number and the refusal text below live in this file only — every other mention points here rather than restating the number.

Dialog question 12, asked immediately after question 11 (Milestone + labels), on **every** issue creation regardless of type or flags: **"How many half-days is this?"**

- **No answer → refuse to create.** The skill does not proceed to the preview; it prints an `Error:` block naming the missing estimate and ends the run. No issue is created.
- **An answer above four half-days → refuse to create, and demand a split.** Shaped exactly like the existing hard error for an unimplemented loop type (see "Supported types" above) — a printed `Error:` block that ends the run outright, never a warning the user can click past, and never a fourth verdict beside APPROVE / REVISE / CANCEL in the issue preview. It fires **before** the preview is offered, the same place the loop-type error fires:

  ```
  Error: estimate of <N> half-days exceeds the 4-half-day cap.
  Split this into smaller issues before creating — an issue this large outgrows
  what a single loop can review in one pass. Re-run /create-issue once per split.
  ```

- **Four or fewer → proceeds.** The value is rendered into the issue body via the `{{estimate_half_days}}` placeholder in both issue templates, so it can be read against the actual duration later.

**No retroactive block.** This question governs issue *creation*, not `/work-issue`'s pre-flight — an issue created before this change, or any issue whose body carries no estimate line, is never blocked by `/work-issue` on that account. `/work-issue`'s mandatory completeness pre-flight (`skills/work-issue/SKILL.md`) checks AGENTS.md fields, never an issue-body field this skill renders.

**Why half-days, and why four half-days rather than some other number:** recorded in `docs/adr/0026-issue-scope-discipline.md`, not restated here.

## Work-stretch end date (`due_on` anchoring)

**Canonical home.** The date requirement and the `due_on` anchoring below live in this file only.

"Done when it fits" never ends — a stretch of work needs a **date** to end on, not a state to reach. Question 11 already has the user pick from the repo's open milestones (`gh api repos/<slug>/milestones`); this is what that pick now requires.

- **The date is GitHub's native milestone `due_on` field** — not a parallel date field invented for this purpose. Nothing new is stored; the requirement is only that the *chosen* milestone actually carries one.
- **A milestone with no `due_on` is refused at selection**, with two named ways forward — never a silent third option that creates the issue anyway:

  ```
  Error: milestone "<name>" has no due date (due_on).
  Pick a different milestone, or set one now:
    gh api -X PATCH repos/<slug>/milestones/<n> -f due_on=<YYYY-MM-DDTHH:MM:SSZ>
  ```

- **Choosing no milestone at all stays legal — only for work that is not a stretch of work.** A typo fix or a label correction has no beginning-and-end shape for a date to anchor to; every other issue is expected to pick a dated milestone. The skill does not classify which case an issue is on its own — declining the milestone question is itself the user's classification, the same posture the `area:`/`feature:` skip-is-legal rule already takes elsewhere in this dialog.

**Why `due_on` rather than a new field:** recorded in `docs/adr/0026-issue-scope-discipline.md`, not restated here.

## codebase-memory integration in detail

For the files-to-touch suggestion and spec enrichment:

1. Extract keywords from the idea (nouns, function names, module hints).
2. `search_code` for each keyword → matching functions + files.
3. `get_architecture` → cluster context for the matches (which modules are connected).
4. Hotspots = files with high connection density → flag as diff risks.
5. Suggestion to the user: "These files will likely be touched: `path/a.ts`, `path/b.ts`. Hotspot warning for `path/core.ts` (high connectivity — changes there have wider impact)."

## AGENTS.md generation (delegated to /init-agents)

AGENTS.md generation is centralized in `/init-agents` (single source).

If AGENTS.md is missing, `/create-issue` calls `/init-agents --repo <slug> --interactive` in the pre-step (step b) and returns afterward. That guarantees `/work-issue` (pure-reader) can pick the issue up directly.

## Repo-registry update

If `<repo>` is not in `~/.claude/work-issue-paths.yaml` yet:
- ask once for `repo_path`
- ask once for `deploy_command` (optional)
- ask once for `live_path` (optional, otherwise = `repo_path`)
- persist

The repo is then ready for `/work-issue` immediately afterward.

## Issue-body templates (multi-type)

Templates live externally in `references/issue-templates/<type>.md` and are loaded at
render time. Currently two types:

| Type | Template file | When |
|------|---------------|------|
| `code` | `references/issue-templates/code.md` | software implementation tasks (feature, fix, refactor) |
| `research` | `references/issue-templates/research.md` | knowledge generation, test-matrix study, library comparison |

Both templates define the required sections that `/work-issue`'s Validator checks strictly.

### Shared required sections (all types)

- `## Idea (Why)`
- `## Spec (What)`
- `## Acceptance Criteria`
- `## Files to Touch`
- `## Test Plan`
- `## Dependencies / Blocks`
- `## Out of Scope`
- `## Standards Override` (optional)
- `## Standards Notes` (optional, but mandatory for research type via the template)

For type-specific differences see the template files.

### Roadmap

`text`, `decision`, `diagnostic` templates are not implemented yet. See the
roadmap issues in the repo (labels `loop-type` + `roadmap`).

## Standards source

Same as `/work-issue` (2-tier: AGENTS.md → issue override). `/create-issue` uses it primarily for:
- `ac_templates` — **auto-injected** in the AC block (see the next section, not just "suggested")
- `default_oos` (suggested in the spec dialog)
- `hard_gates` (inserted as required ACs when relevant)
- `strategy.gates` — the enabled strategic gates, **injected** into the AC block via the mechanism each one owns (see "Strategic Gates" below); absent block → nothing changes

## Auto-injection of AGENTS.md `ac_templates`

The render logic in step (e3) acceptance criteria is opinionated: AGENTS.md `ac_templates` are **injected**, not merely suggested. Three modes:

### Mode 1 — default (no standards override)

All `ac_templates` items from AGENTS.md are **prepended** in the rendered AC block as required items (clearly labeled "**from AGENTS.md `ac_templates`**"), followed by issue-specific user ACs.

### Mode 2 — override `ac_templates: []` (empty)

The block is left empty; the user must explicitly supply replacement ACs (typical for docs-only issues). The skill **warns** if the AC block stays empty and no user ACs are submitted.

### Mode 3 — override with a partial/different list

The override list **completely replaces** the AGENTS.md templates and is rendered in the same required block, plus user ACs.

### Rendered-format example

```markdown
## Acceptance Criteria

### from AGENTS.md `ac_templates` (required)
- [ ] <template 1>
- [ ] <template 2>
- ...

### Issue-specific
- [ ] <user AC 1>
- [ ] <user AC 2>
```

This injection is active in step (e3) of the workflow definition — **inject**, not suggest. During the spec dialog the user can rephrase required items via `EDIT` or remove them via `DISMISS` (with reasoning in the `## Standards Notes` block), but they are present by default.

## Component Reuse Check (opt-in via AGENTS.md `components:`)

If AGENTS.md carries a `components:` block AND the issue idea lands in the registry's scope, an additional **Component Reuse Check** AC section is auto-injected into the AC block.

### Scope trigger

The check fires when both are true:

1. **AGENTS.md `components:` block is present** (opt-in).
2. **Issue signals registry scope** — any of:
   - Idea or spec text contains a component keyword: `table`, `datatable`, `form`, `modal`, `menu`, `navigation`, `nav`, `entity`, `value object`, `aggregate`, `domain`.
   - Files-to-touch matches any pattern in `components.code_globs`.
   - The `components.scope` value narrows this further: `scope: frontend` only fires on frontend keywords / globs, `scope: backend` only on backend keywords / globs, `scope: both` fires on either.

If neither condition is met, no reuse-check block is injected — zero behavior change.

### Injected AC section

Rendered as an additional sub-block inside `## Acceptance Criteria`, right after `### Hard-Gates` and before `### Issue-specific`:

```markdown
### Component Reuse Check (AGENTS.md `components:`)
- [ ] Existing registry component reused (name it) OR new component approved via an ADR (link the ADR path in `## Standards Override`)
- [ ] If new: ADR at `docs/adr/<n>-<slug>.md` covers rationale, alternatives, and registry entry stub
- [ ] Backend contract shape (if applicable) matches the registry's declared shape or is versioned via an ADR
```

### Enforcement level

The user cannot silently `DISMISS` the block — the enforcement level is set at the repo level via `usage_policy`:

- **`prefer_existing`** — Validator will warn but not STOP if the reuse check is not answered. Critic still runs dupe detection.
- **`strict`** — Validator STOPs the issue unless the first checkbox names an existing registry component or links an ADR path in the issue's `## Standards Override` block.

The check is intentionally added at issue-creation time so the Implementer never even starts an inline-duplication path.

### Relationship to `strategy.gates.component_reuse` (additive, never a precondition)

The trigger above is **unchanged and complete**: a `components:` block plus a scope signal fires the check, exactly as it always has. `strategy.gates.component_reuse` is **never** a precondition for it. A repo with `components:` and **no `strategy:` block** behaves exactly as it does today — no question is added, no AC is withheld, nothing about the injected block changes.

What the gate adds is only this, and only where it is declared `true`:

- the pre-flight consistency report in `skills/work-issue/SKILL.md` when the gate is `true` and **no `components:` block exists** — the gate promises reuse the repo cannot enforce (report, never a STOP);
- the gate's state in the `/plan-issues` output.

The relationship is therefore additive in one direction only: `components:` switches the check on; the gate switches nothing off.

## Strategic Gates (opt-in via AGENTS.md `strategy.gates`)

**This section is the canonical home of what each gate injects at issue-creation time.** Whether the block exists at all, and its shape and opt-in semantics, are canonical in the repo's root `AGENTS.md`, section "Strategic Software Development (optional `strategy:` block)". What "unconfigured" means per gate, and the pre-flight report itself, are canonical in `skills/work-issue/SKILL.md`, section "Optional `strategy.gates` consistency report". Neither is restated here.

**No `strategy.gates` in AGENTS.md → nothing in this section happens.** No question is asked, no AC is injected, no output changes. A gate set to `false` is treated exactly like an absent gate.

### What each gate injects

Read the gates in the same pass as `ac_templates` (step b). For every gate that is `true` **and** applies to this issue:

| Gate | Applies when | What `/create-issue` injects |
|---|---|---|
| `architecture_adr` | the issue changes behaviour, a documented default, a contract or the architecture — a pure wording/typo issue does not fire | the **ADR Check** AC sub-block below (canonical here — this is the only gate whose AC text has no other owner) |
| `component_reuse` | the Component Reuse Check's own scope trigger fires (see above) | **nothing new.** The Component Reuse Check above owns the trigger, the AC text and the enforcement level; the gate does not re-inject, re-word or re-trigger any of it |
| `test_evidence` | always — every issue carries an AC block | **nothing new.** The `ac_templates` auto-injection above already renders the repo's evidence ACs. The gate's only effect: a `DISMISS` of an injected AC that concerns test evidence is **refused** (it may be rephrased via `EDIT`, not removed), same posture as the Component Reuse Check's non-dismissible block |
| `documentation` | the issue changes user-visible behaviour, a documented contract or anything the repo's docs describe | the **Documentation Check** AC sub-block below, built from the repo's own fields — see the lookup rule |

Each injected sub-block is rendered inside `## Acceptance Criteria`, right after `### Hard-Gates`, in the same position and shape as the Component Reuse Check.

An AC "concerns test evidence" when it names a test, a check, a verification command or the evidence one produces — the same kind of read as the docs lookup below, applied to `ac_templates` the repo already declares. When no injected AC concerns test evidence, the gate has nothing to protect and refuses nothing; the pre-flight decides separately whether that state is worth reporting.

### ADR Check (canonical AC text)

```markdown
### ADR Check (AGENTS.md `strategy.gates.architecture_adr`)
- [ ] The behaviour / default / contract change is recorded in an ADR at `docs/adr/<n>-<slug>.md` (decision, alternatives, consequences)
- [ ] The ADR is linked from the issue or the PR body, and from every file whose contract it changes
- [ ] OR: this issue changes no behaviour, default or contract — stated in `## Standards Notes` instead of an empty ADR
```

This is the **only** place the ADR AC text and its trigger are defined. Every other mention in this repo points here.

A version-relevant default flip may additionally fall under the repo's `version_policy` ADR rule. That rule stays canonical in the repo's root `AGENTS.md`, `version_policy` field, and is **not** repeated here — the two are independent: this gate asks for an ADR because the *architecture* changed, `version_policy` asks for one because the *version* semantics demand it.

### Documentation Check and the docs AC-template lookup

**"The docs AC template" is a lookup into the repo's own `ac_templates`, not an artifact this plugin ships.** The lookup is: an entry of the repo's `ac_templates` whose text concerns documentation — it names a documentation artifact (`README`, `CLAUDE.md`, `docs/`, a changelog) or the word *documentation* / *docs*. The first matching entry is the repo's docs AC template. **No match is a legal state** — it means the repo has no documentation AC, which is exactly what the pre-flight report is for. This plugin never invents one.

The injected block, built from what the repo actually declares:

```markdown
### Documentation Check (AGENTS.md `strategy.gates.documentation`)
- [ ] Derived documentation regenerated via `docs_command` — or `docs_command: ""` / absent recorded as not applicable, saying which of the two it was
- [ ] The repo's documentation AC template is satisfied: `<matched ac_templates entry>`
```

The second line is rendered **only** when the lookup matched; with no match the block carries the first line alone. Neither line restates `docs_command` — its three-state semantics (`real command` / declared `""` / absent field) stay canonical where the Tester reads them, in `skills/work-issue/SKILL.md`.

### Who checks these ACs later

Nothing in `/work-issue` gets a new checking stage: an injected gate AC is an ordinary item of the issue's AC block, so the Tester verifies it and the Critic's `APPROVE — all ACs OK` verdict already covers it. The gates change what the issue *asks for*, never how the loop verifies an AC.

## Issue-type detection

6 triggers, regex/keyword-based. The heuristic runs BEFORE the render step (e6 issue preview). Triggers can stack — an issue can fire multiple triggers (e.g., a new MCP skill with `ANTHROPIC_API_KEY` → #3 + #4 active).

| # | Trigger condition | Required extension |
|---|-------------------|--------------------|
| 1 | Label `docs`/`documentation` OR all files-to-touch match `^docs/`, `\.md$`, `^LICENSE$`, `^CONTRIBUTING` | Standards-override block (`ac_templates: []`) + suggest docs-specific replacement ACs (Markdown lint, ADR-schema grep, Mermaid via `mmdc`) |
| 2 | Label `epic` OR `>5` files-to-touch OR spec block `>800` words | Epic warning in the preview: "Sub-issue split recommended. OoS must contain the sub-issue list or the issue must be restructured." |
| 3 | Spec OR test plan contains the pattern `[A-Z_]+_(KEY\|TOKEN\|SECRET\|PAT)` OR the strings "token"+"env" / "secret"+"PAT" | Secret-handling reminder: ACs for `.env.example` entry, `docker-compose env_file:` hint, entrypoint preflight, secret scan before commit |
| 4 | Spec contains `claude mcp add` OR `mcp__` OR "MCP tool" OR "MCP plugin" | MCP side-effect-verification reminder: ACs for side-effect verification in `~/.cache/claude-cli-nodejs/.../mcp-logs-<name>/*.jsonl` |
| 5 | Test plan OR AC contains a chat/messaging API, "gh issue create", "API call", external URLs, `curl` with a token | Mock/dry-run requirement: ACs + test plan need a `DRY_RUN=1` env flag or a sandbox target. Cost warning in the preview. |
| 6 | Test plan contains `docker compose up`, `systemctl restart`, "deploy", "live", "API call" | Cleanup requirement: ACs for a cleanup statement in the Tester (service teardown, test-data purge, original state restored) |

### Skill reaction to triggers

1. In the spec dialog before the final preview the skill prints **detected triggers as a list with reasoning** (e.g., `"Trigger #3 secret handling: detected 'ANTHROPIC_API_KEY' in spec block"`).
2. Per trigger, **AC items are automatically suggested** — user: `APPROVE` / `EDIT` / `DISMISS`.
3. `DISMISS` writes a `## Standards Notes` block into the issue with reasoning (e.g., "Secret handling dismissed: token will be introduced via a separate issue #N").

### Worked example (illustrative)

One trigger — #3 — is worked through end to end in `references/trigger-example.md`: sample spec, detected pattern, the four suggested AC items, and the per-item decision. It is there to show the shape of a trigger reaction once, and it is explicitly **not** a template for the other five triggers. The contract for every trigger stays in the table above.

## Refine mode

`/create-issue --refine <num>` loads an existing issue and fills in missing sections. For the case where `/work-issue` returned STOP because the spec was incomplete. Workflow (6 steps):

1. **Load the existing body** — `gh issue view <num> --repo <slug> --json title,body,labels,milestone`
2. **Run type detection on the existing body** — check all 6 triggers, identify which fire.
3. **AGENTS.md `ac_templates` diff** — which templates are missing in the current AC block? → required add (or standards-override block if justified).
4. **Trigger diff** — which triggers fire whose required ACs are missing in the existing body? → required add.
5. **Area check** — no `area:<name>` label on the issue? → offer to set one (same suggestion source as dialog question 8). Skipping is allowed; guessing is not. Where AGENTS.md declares `strategy.feature_axis`, the same applies to a missing feature label (dialog question 10's suggestion source and `require_on` rule).
6. **User diff approval** — the skill shows **only the changes** (not the whole body); the user APPROVES / REJECTS per item. Approved items are integrated into the body via `gh issue edit <num>`.

This way refine mode catches exactly the spec-gap pattern that leaves the producer side too lenient.

## Scope boundaries vs. /work-issue

| Skill | When |
|-------|------|
| `/create-issue` | Idea exists, no issue yet. OR issue exists without spec → `--refine` |
| `/work-issue` | Issue with spec → build loop to a reviewed, merged PR (the Closer merges in-loop) |

## What this skill does NOT do

- Does not write code (only the issue body)
- Does not create branches
- Does not resolve cross-repo dependencies (depends-on is inserted only as a reference, not resolved)
- Does not infer `area:` when the user skips the question, and never sets `bundle:` — see "Area label (`area:`)"
- Does not infer `feature:`, and does not ask for one at all unless AGENTS.md declares `strategy.feature_axis` — see "Feature label (`feature:`)"

## See also

- `skills/init-agents/SKILL.md` — bootstrap phase (create AGENTS.md, mandatory before the first run)
- `skills/plan-issues/SKILL.md` — planning phase; canonical `area:` / `bundle:`, `goal:` / `waiting-on:`, `feature:` and `found-in-loop` label contracts
- `skills/work-issue/SKILL.md` — execution phase
- `skills/work-issue/references/repo-registry.yaml.example`
- `skills/init-agents/references/AGENTS.md.template`
- `skills/create-issue/references/issue-templates/code.md` — code-loop template
- `skills/create-issue/references/issue-templates/research.md` — research-loop template
- `skills/work-issue/references/subagent-briefs/code-implementer.md` — code-implementer brief
- `skills/work-issue/references/subagent-briefs/research-implementer.md` — researcher brief

## Visual Acceptance Injection (opt-in via AGENTS.md `visual:`)

If AGENTS.md carries a `visual:` block AND the issue lands in frontend scope, an additional **Visual Acceptance** AC section is auto-injected into the AC block — analogous to the Component Reuse Check.

### Scope trigger

The check fires when both are true:

1. **AGENTS.md `visual:` block is present** (opt-in).
2. **Issue signals frontend scope** — any of:
   - Idea/Spec text contains a frontend keyword: `page`, `route`, `UI`, `component`, `layout`, `responsive`, `screen`, `viewport`.
   - Files-to-touch matches a frontend glob (e.g. `**/*.tsx`, `**/*.vue`, `**/*.svelte`, `src/pages/**`, `src/components/**`).

If neither condition is met, no Visual Acceptance block is injected — zero behavior change.

### Injected AC section

Rendered as an additional sub-block inside `## Acceptance Criteria`, after `### Component Reuse Check` (if present) and before `### Issue-specific`:

```markdown
### Visual Acceptance (AGENTS.md `visual:`)
- [ ] Declared route(s) render without console errors at all configured viewports
- [ ] Key element(s) named in the spec are visible above the fold at the mobile viewport (390px)
- [ ] No horizontal overflow / layout break at mobile and desktop
- [ ] Screenshot evidence attached in the `[stage:visual]` comment
```

The user can add issue-specific Visual Acceptance checkboxes (e.g. "the CTA is sticky on mobile"). These ACs are what the `/work-issue` Visual Reviewer stage (3.5) evaluates against the rendered screenshots.
