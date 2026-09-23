---
name: plan-issues
description: "Backlog planner. Derives the actionable work-list — `<goal>` minus every issue carrying `<waiting-on>:*` — from the open issues before the work-issue loops start. Canonical home of the area:/bundle:, goal:/waiting-on:, feature: and found-in-loop issue-label contracts, and the source of the start-time collision report (open PRs whose real diffs overlap a candidate). Groups the work-list by feature: and notes an oversized feature where the repo opted into the strategy.feature_axis block, and surfaces the strategy.gates state in the plan output. Outputs a plan for human review; no code is written. Pipeline position: create-issue → plan-issues → work-issue. Triggers: /plan-issues, plan issues, backlog plan, plan before work, work-list, area label, bundle label, feature label, feature axis."
---

# /plan-issues — Backlog planning before the work loops

**Type:** planning / backlog analysis

## Purpose

Before the `/work-issue` loops run, `plan-issues` reads the open issues and produces, for human review, the **actionable work-list**: the issues that serve a goal and are not blocked — `<goal>` **minus** every issue carrying a `waiting-on:*` label (the query defined in "Label contract — `goal:` and `waiting-on:`" below). It writes no code and starts no work.

**The work-list answers "what can I start now?" — priority answers "what matters most?"** Both are needed; they solve different problems. The work-list is derived on read from the two label axes; priority is the importance ranking within it.

**The parallel-safety question is not frozen into a label.** It is answered by the start-time collision report below — read once and thrown away rather than trusted long after it stopped being true. Rationale and the accepted trade-off: `docs/adr/0006-label-axes.md`.

Neither axis answers the other question a human asks of a backlog — **what is this issue about, and what does it ship with.** Those two are recorded as the `area:` and `bundle:` labels, whose contract this skill owns (see "Label contract" below), and they are stable facts about the issue: they do not go stale when a neighbouring issue merges.

A repo that has opted into the `strategy.feature_axis` block carries a third stable fact — **which building block this issue builds**, the `feature:` label. Its contract is owned here too, and `plan-issues` groups the work-list by it and notes a feature that has grown unusually large (step 5b). Without the block nothing about the plan changes.

A repo that declares `strategy.gates` also gets its **gate state** printed in the plan (step 9) — which strategic dimensions it has switched on — so that fact is on the table while the work-list is being reviewed, not discovered one loop later. It is state only: `plan-issues` enforces no gate and evaluates no gate's mechanism.

What *is* time-dependent — which issues can be started right now without walking into someone else's open PR — is deliberately **not** frozen into a label. It is printed as a start-time report addressed to the human (step 7), and it is wrong the moment a PR merges. That is the point: a report is read once and discarded, a label is trusted long after it stopped being true.

### Pipeline position

```
create-issue → plan-issues → [human review] → work-issue (per issue on the work-list)
```

## Invocation variants

```
/plan-issues --repo owner/slug
/plan-issues --repo owner/slug --milestone "v2.0"
/plan-issues --repo owner/slug --label "sprint-current"
/plan-issues --repo owner/slug --bundle beta-v1   # human-supplied batch name for this run
/plan-issues                          # → resolves repo from cwd, uses all open issues
```

**Filters (optional):** `--milestone`, `--label`, `--issue <num>[,<num>...]` narrow the issue set. Without filters, all open issues are planned.

**`--bundle <name>`** is not a filter. It is the human declaring, for this run, which bundle these issues ship in — one of the three legal `bundle:` sources (see "Label contract"). Omitted, no bundle is invented for anyone.

## Label contract — `area:` and `bundle:` (canonical)

**This section is the single canonical definition of the `area:<name>` and `bundle:<name>` label contract** — grammar, lifetime, who writes them, who reads them. `/create-issue`, `/init-agents`, this repo's root `AGENTS.md` and every other mention point here instead of restating it. If the contract changes, it changes here and nowhere else.

**The one permitted copy artifact:** the commented-out `plan-issues:` block in `skills/init-agents/references/AGENTS.md.template`. A template has to be readable standalone, so it carries the *shape* of the block instead of a pointer to it. It is named as a copy artifact here and in this repo's root `AGENTS.md`; the two change together.

### What each label answers

| Label | Answers | Example | Lifetime |
|---|---|---|---|
| `area:<name>` | What is this issue about? | `area:retrieval`, `area:admin` | the life of the issue |
| `bundle:<name>` | What ships together? | `bundle:beta-v1` | until the bundle ships |

Both are **stable facts about the issue**. Neither goes stale when another issue merges — that is exactly the property a batch number lacks, because a batch number is a statement about a set of issues and the set changes underneath it.

### Grammar

- A label name matches exactly `^area:[a-z0-9][a-z0-9-]*$` or `^bundle:[a-z0-9][a-z0-9-]*$` — lowercase letters, digits and hyphens after the prefix. Valid: `area:retrieval`, `area:admin-ui`, `bundle:beta-v1`. Not valid: `Area:retrieval` (prefix is lowercase), `area:Retrieval`, `area: retrieval`, `area:` (empty), `area:user_auth` (underscore), `bundle:2026 Q4` (space).
- An issue carries **at most one** `area:` label and **at most one** `bundle:` label. Two of either on the same issue is a conflict: report it and ask at the review gate (step 10), never pick one silently.
- A `area:`- or `bundle:`-prefixed name that does not match the grammar is **reported as ignored** in the plan summary and otherwise left alone. It is never renamed, never deleted, and never a STOP.

### Who writes them

| Label | Written by | Removed by |
|---|---|---|
| `area:<name>` | `/create-issue` at creation (see `skills/create-issue/SKILL.md`, spec-dialog step e8); `/plan-issues` step 11 for a candidate that has none yet | nothing in this plugin — it stays for the life of the issue |
| `bundle:<name>` | `/plan-issues` step 11, **only from an existing source** (below) | nothing in this plugin — whoever ships the bundle removes it |

### Who reads them

**Today: humans.** No skill in this plugin branches on `area:` or `bundle:` — they exist so a person can filter a backlog by subject and by shipment, which nothing else in the label set allows. They are deliberately not wired into merge order.

### `bundle:` is never invented

A bundle is a release decision. Inventing a name would produce precisely the confidently-wrong declaration this contract exists to avoid. `/plan-issues` sets `bundle:` from **one of three sources only**:

1. **An existing `bundle:<name>` label on the issue** — kept as it is, never overwritten.
2. **A declaration in the issue body** — a line matching `bundle: <name>` (case-insensitive on the key).
3. **`--bundle <name>` on this run** — the human naming the batch. It applies only to candidates that have no bundle of their own from (1) or (2).

If (3) disagrees with (1) or (2) for a given issue, the existing value wins and the disagreement is reported at the review gate. **A candidate with none of the three sources gets no `bundle:` label — and no warning.** Absence of a bundle is the normal state of an issue, not a defect to nag about.

### `area:` sources

1. **An existing `area:<name>` label** — kept as it is.
2. **A declaration in the issue body** — a line matching `area: <name>` (case-insensitive on the key).
3. **The human at the review gate** (step 10), for every candidate that has neither.

`area:` is **never inferred** — not from the touched files, not from the title, not from a diff. A guessed area is the same failure as a guessed file path: confidently wrong, and wrong quietly.

### `area:` vocabulary — the optional `plan-issues:` block in AGENTS.md

A repo may declare its area vocabulary in the AGENTS.md YAML frontmatter:

```yaml
plan-issues:
  areas: ["retrieval", "safety", "admin", "billing", "ops"]
```

- **The block is optional.** Absent → every `area:` value is accepted, and the plan output carries the one-line note `note: no plan-issues.areas declared in AGENTS.md — area: values are unvalidated`. The run completes normally.
- **Declared** → a value that is not in the list produces a **warning**, never a STOP: `warning: #47 area "checkout" is not in AGENTS.md plan-issues.areas — accepted; add it to the list if it is real`. The label is still written.
- **`plan-issues:` is explicitly not part of `/work-issue`'s mandatory AGENTS.md completeness pre-flight.** A missing block must never STOP a loop — same posture as `models:`.

**Why optional rather than mandatory.** A new area is a normal event; blocking on one pushes people back to no label at all, which is the state this contract is trying to leave. And a mandatory field does not pay for itself here: `docs_command` shipped as mandatory and broke the `/work-issue` pre-flight of every existing repo within the hour. A field whose only effect is a warning does not justify that cost.

## Label contract — `goal:` and `waiting-on:` (canonical)

**This section is the single canonical definition of the `goal:<value>` and `waiting-on:<value>` label contract** — grammar, lifetime, who writes them, who reads them, and how the actionable work-list is derived from them. `/create-issue`, `/init-agents`, `/work-issue` and every other mention point here instead of restating it. If the contract changes, it changes here and nowhere else.

`area:`/`bundle:` (above) are unaffected — these two axes sit beside them, they do not replace them.

### Two orthogonal axes

A backlog stays actionable only if two questions have answers a skill can read: **what goal does an issue serve**, and **what does it wait on**. They are orthogonal — an issue can be fully specified and still not startable — so they are two labels, never one.

| Label | Answers | Cardinality | Example | Lifetime |
|---|---|---|---|---|
| `goal:<value>` | What cannot be reached without this issue? | **exactly one** (when opted in) | `goal:public-launch` | the life of the issue |
| `waiting-on:<value>` | What blocks this issue right now? | **zero or one** | `waiting-on:42`, `waiting-on:design` | until the blocker clears, then removed |

**The work-list is a query, never a label.** The set of issues that are actually startable is `<goal>` **minus** every issue carrying a `waiting-on:*` label — computed on read, never stored. A stored "work-list" or "ready" label is an inference that has to be re-maintained and goes stale the moment a blocker clears; the query cannot. Do not add a third derived label for it.

### The axis prefixes are configurable (defaults `goal:` / `waiting-on:`)

The two prefixes are read from the repo's AGENTS.md `plan-issues:` block (`goal_prefix`, default `goal:`; `waiting_prefix`, default `waiting-on:`). Nothing is hardcoded, so a repo keeps its own vocabulary in its own language while this repo stays English-only — the originating project uses `ziel:` / `wartet:`. Every rule below is written against the resolved prefix, not the literal string `goal:`.

### Grammar

- A goal label matches `^<goal_prefix>[a-z0-9][a-z0-9-]*$`, a waiting-on label `^<waiting_prefix>[a-z0-9][a-z0-9-]*$` — lowercase letters, digits and hyphens after the prefix. A `waiting-on:` value that is a bare issue number (`waiting-on:42`) is the canonical form for a dependency.
- An issue carries **at most one** `goal:` label and **at most one** `waiting-on:` label. Two of either is a conflict: report it and ask, never pick one silently.
- A prefixed name that does not match the grammar is **reported as ignored** and otherwise left alone — never renamed, never deleted, never a STOP.

### `waiting-on:` records who or what — always

A `waiting-on:` label **without a recorded who/what is worthless**: it says an issue is blocked but not by what, which is exactly the drift this contract exists to remove. Whoever sets the label writes into the issue body or a comment who or what is needed — for a dependency, the blocking issue number. The label is the flag; the note is the content, and the label is not legitimately set without it.

### The check-question (goal ≠ urgency)

`goal:` names what an issue *serves*, not how soon it is wanted — those are different axes, and conflating them is how goal labels rot into priority labels. The disambiguating question, asked when the goal is set, is:

> **What happens if we try to reach the goal WITHOUT this issue?**

If the honest answer is "the goal is still reached, just later or less comfortably", the issue does not belong to that goal — it is urgency wearing a goal label. `/create-issue` prints this question at the goal step (see `skills/create-issue/SKILL.md`).

### Who writes them

| Label | Written by | Removed by |
|---|---|---|
| `goal:<value>` | `/create-issue` at creation (single-select from the AGENTS.md vocabulary), when the repo has opted in | nothing in this plugin — it stays for the life of the issue |
| `waiting-on:<value>` | whoever knows the block — a human, or a skill that discovers a dependency — together with the note recording what is waited on | whoever clears the block, once it is cleared |

### Who reads them

- **`/work-issue` reads `waiting-on:`** — a pre-flight STOP fires on any `waiting-on:*` label (an issue that is specified but not actionable), at the same severity tier as a missing AGENTS.md, pointing at the issue's waiting-on note (canonical in `skills/work-issue/SKILL.md`).
- **Humans read the query** — `<goal>` minus `<waiting-on>:*` is the actionable list for a goal, filtered on read. `/plan-issues` prints exactly this list (step 5).
- No skill branches on the `goal:` *value* today; it exists so the backlog can be filtered and the work-list query can be run.

### Vocabulary and defaults — the optional `plan-issues:` block in AGENTS.md

The goal values are project-defined; no goal name is hardcoded. A repo opts in by declaring them:

```yaml
plan-issues:
  goals: ["public-launch", "cost-down", "reliability"]
  goal_default: "public-launch"    # offered first in the single-select; optional
  goal_prefix: "goal:"             # optional; default goal:
  waiting_prefix: "waiting-on:"    # optional; default waiting-on:
```

- **The block is optional, and so is the `goals:` key within it.** Absent `goals:` → `/create-issue` asks no goal question, `/init-agents` creates no goal labels, and `/work-issue`'s `waiting-on:` STOP still applies (the STOP keys on the resolved `waiting_prefix`, which has a default, not on the vocabulary). **Absent block = zero behavior change** for every skill.
- **Declared** → `/create-issue` offers the listed goals as a single-select and `goal_default` (if set) is offered first.
- **`goals:` is deliberately in the `plan-issues:` namespace**, beside `areas:` — both are the repo's issue vocabulary. It is **not** part of `/work-issue`'s mandatory AGENTS.md completeness pre-flight; a missing block never STOPs a loop, same posture as `areas:` and `models:`.

### Label retirement — a superseded label is never deleted

When a goal is renamed or retired, the old `goal:<value>` **repository label is never deleted** — issues already carrying it keep a valid reference, and a deleted label silently strips itself from every issue that had it. A retired goal is dropped from the AGENTS.md `goals:` vocabulary (so it stops being offered) and left in place on GitHub. Any check that counts or lists issues by a possibly-retired label must query with `--state all`, so a closed issue's goal is still seen. Rationale: `docs/adr/0006-label-axes.md`.

## Label contract — `feature:` (canonical)

**This section is the single canonical definition of the `feature:<name>` label contract** — grammar, cardinality, lifetime, the legal sources a value may come from, who writes and reads it, and what happens to a retired one. `/create-issue`, `/init-agents`, this repo's root `AGENTS.md`, `CLAUDE.md` and every other mention point here instead of restating it. If the contract changes, it changes here and nowhere else.

`area:`/`bundle:` and `goal:`/`waiting-on:` (above) are unaffected — this axis sits beside them, it replaces neither.

**The switch is not part of this contract.** Whether the axis is on at all, its prefix, which issue types must carry it and the size threshold are the `strategy.feature_axis` block, whose shape and opt-in semantics are canonical in the repo's root `AGENTS.md`, section "Strategic Software Development (optional `strategy:` block)". That split is deliberate and recorded in `docs/adr/0008-strategy-block.md` §4: **`strategy:` owns whether and how the axis is switched on; this contract owns what the label means.** Neither restates the other.

**No `strategy.feature_axis` block → the axis does not exist for that repo.** `/create-issue` asks no feature question and sets no label, `/plan-issues` groups nothing by feature and prints no size note, and nothing below applies. Zero behavior change.

### What the label answers

| Label | Answers | Cardinality | Example | Lifetime |
|---|---|---|---|---|
| `feature:<name>` | Which building block does this issue build? | **at most one** | `feature:admin-ui` | the life of the issue |

`area:` records the subsystem an issue is about and `goal:` the release target it serves; neither says which building block is being built. That is the question this axis answers, and it is what makes building-block size visible in planning — the issues that belong to one feature stop being scattered across the backlog.

Like `area:` and `goal:`, a feature label is a **stable fact about the issue**: it does not go stale when a neighbouring issue merges.

### The prefix is configurable (default `feature:`)

The prefix is read from `strategy.feature_axis.prefix` (default `feature:`), exactly as `goal_prefix` / `waiting_prefix` are read. Nothing is hardcoded, so a repo keeps its own vocabulary in its own language while this repo stays English-only. **Every rule below is written against the resolved prefix**, never against the literal string `feature:`; the examples use the default prefix only because an example needs a concrete value.

### Grammar

- A feature label matches `^<feature_prefix><value>$`, where `<value>` matches `[a-z0-9][a-z0-9-]*` — it starts with a lowercase letter or a digit and continues with lowercase letters, digits and hyphens. With the default prefix, valid: `feature:admin-ui`, `feature:billing`, `feature:oauth2`. Not valid: `Feature:admin-ui` (the prefix is matched exactly as declared, case included), `feature:Admin-UI` (uppercase in the value), `feature: admin-ui` (space), `feature:` (empty value), `feature:admin_ui` (underscore).
- An issue carries **at most one** feature label. Two on the same issue is a conflict: report it and ask at the review gate (step 10), never pick one silently.
- A prefixed name that does not match the grammar is **reported as ignored** in the plan summary and otherwise left alone — never renamed, never deleted, never a STOP.

### Legal sources — free text, not a declared vocabulary

The legal values are deliberately **not** enumerated in AGENTS.md, and that is the difference from `goal:`. Goals are few and stable enough to be a single-select; features are many, project-specific and created continuously, so a declared feature list would be stale the week after it was written and would cost more to maintain than the axis is worth. The **existing feature labels in the repo are the working vocabulary** — offered as suggestions, never a closed set: a new value is legal at any time.

A feature label is set from one of three sources only:

1. **An existing feature label on the issue** — kept as it is, never overwritten.
2. **A declaration in the issue body** — a line matching `feature: <name>` (case-insensitive on the key).
3. **A human answering `/create-issue`'s feature question** (see `skills/create-issue/SKILL.md`, "Feature label (`feature:`)"), with the repo's existing feature labels offered as suggestions.

The value is **never inferred** — not from the title, not from the `area:` label, not from the files-to-touch list. A guessed feature is the same failure as a guessed area: confidently wrong, and wrong quietly. An issue with none of the three sources simply carries no feature label.

### Who writes them

| Written by | Removed by |
|---|---|
| `/create-issue` at creation, when the repo declares `strategy.feature_axis` — mandatory for the issue types listed in `require_on`, offered but optional for every other type | nothing in this plugin — it stays for the life of the issue |

`/plan-issues` does **not** write this label. It has no third "human at the review gate" source the way `area:` does: the feature question belongs where the answer is cheapest, at creation, and inventing one at plan time would be exactly the guess this contract forbids.

The label is **not** removed when the feature ships. It records what the issue built, and that stays true.

### Who reads them

- **`/plan-issues` reads them** — it groups the work-list by feature and prints the `flag_over` size note (step 5b). That is the only branch any skill takes on this axis.
- **`/create-issue` reads the repo's existing feature labels** — as the suggestion list for its feature question, never as a closed vocabulary.
- **Humans read the grouping** — a backlog per building block, which neither `area:` nor `goal:` gives.
- No skill branches on the feature *value*, and no gate is keyed to it.

### Label retirement — a superseded feature label is never deleted

When a feature is renamed, split or abandoned, the old feature **repository label is never deleted** — issues already carrying it keep a valid reference, and a deleted label silently strips itself from every issue that had it. The retired value simply stops being offered as a suggestion (there is no declared vocabulary to drop it from) and is left in place on GitHub. Any check that counts or lists issues by a possibly-retired feature label must query with `--state all`, so a closed issue's feature is still seen. This mirrors the `goal:` retirement rule above; rationale: `docs/adr/0006-label-axes.md`.

**The `flag_over` size note is the one deliberate exception, and it is not a retirement check.** It counts **open** issues only, because it asks about work in flight — a feature whose issues are all closed is finished, not oversized. Anything that needs a feature's full history queries `--state all`.

## Label contract — `found-in-loop` (canonical)

**This section is the single canonical definition of the `found-in-loop` label** — what it means, who sets it, and what happens to an issue that carries it. `/create-issue`, `/work-issue`, this repo's root `CLAUDE.md` and every other mention point here instead of restating it. If the contract changes, it changes here and nowhere else.

`area:`/`bundle:`, `goal:`/`waiting-on:` and `feature:` (above) are unaffected — this is a fourth, independent marker, not a value on any existing axis. Design rationale: `docs/adr/0026-issue-scope-discipline.md`.

### What the label answers

| Label | Answers | Cardinality | Lifetime |
|---|---|---|---|
| `found-in-loop` | Does this issue exist because a `/work-issue` run surfaced a finding, rather than because a human planned it from scratch? | present or absent — a flag, not a `<value>` label | the life of the issue |

The label exists to keep a running loop's scope from growing silently. A Critic or Tester finding stays a REVISE item under the 3-revise cap **inside the run that found it** — `/work-issue` never files an issue for it (see "Who writes it" below). When a human later turns that finding into its own issue via `/create-issue --from-loop <issue>`, the label records the lineage so a backlog reader, and `/create-issue` itself at the moment it would otherwise offer a handoff, can tell a redirected finding from an issue planned from scratch.

### Grammar

- The label is the exact literal string `found-in-loop` — no prefix, no value, no configurable name. Unlike `area:`, `goal:` or `feature:`, nothing here varies per repo, so there is nothing to resolve against a configurable prefix.
- An issue carries the label or it does not; there is no "two of them" conflict to detect or report.

### Who writes it

| Label | Written by | Removed by |
|---|---|---|
| `found-in-loop` | `/create-issue`, only when invoked as `--from-loop <issue>` (see `skills/create-issue/SKILL.md`, "Loop-finding redirect") | nothing in this plugin — it stays for the life of the issue, a permanent record of where the issue came from |

**`/work-issue` never writes this label.** It has no issue-creating call in a code loop at all (see `skills/work-issue/SKILL.md`, "What this skill does NOT do"), and the one issue-creating call it does have — a research loop's Closer, optionally filing a follow-up implementation issue — is a different mechanism entirely. A Critic/Tester finding is recorded on the originating run's own audit trail as a REVISE item, never as a side effect that creates a second issue.

### Who reads it

- **`/create-issue` reads its own `--from-loop` argument, not the label,** to decide whether to hard-suppress its step-h) handoff question — the label is written on the new issue at the same moment the suppression decision is made, not read back afterward.
- **`/plan-issues` applies no special-casing to it.** An issue carrying `found-in-loop` is fetched, classified, grouped and planned exactly like any other candidate in workflow step 5 below — the label answers "why does this issue exist", not "is it plannable", and nothing in this skill's workflow branches on it. This is deliberate: a redirected finding is ordinary backlog work from the moment it is filed, and treating it as anything less would recreate the appending failure this label exists to prevent, one level up.
- **Humans read it** — a backlog reader can tell a self-originated issue from one that grew out of another run's Critic or Tester finding, which neither `area:`, `goal:` nor `feature:` records.

### Originating-issue reference — recorded in the body, not a second label

The label answers *whether* an issue was redirected from a loop finding; *which* issue it was redirected from is recorded in the new issue's `## Standards Notes` block as a plain line (`found-in-loop: originates from #<issue>`), written by `/create-issue` at creation from its own `--from-loop <issue>` argument. It is not a second label — a value-carrying `found-in-loop:<N>` label would duplicate what `depends on #X` already does, for no benefit: nothing branches on the originating issue number the way the dependency check (workflow step 6) branches on a declared dependency.

## Workflow

### 1. Issue fetch

```bash
gh issue list --repo <slug> --state open --json number,title,labels,body,assignees --limit 100
```

Apply any milestone/label/number filters. The result is the **candidate set** — the issues to be planned.

### 2. Loop-type classification

For each issue, determine loop type from the `loop-type:<type>` label (set by `/create-issue`):
- `loop-type:code` → code loop; may touch source files → collision risk
- `loop-type:research` → research loop; writes only to `docs/research/` → collision-free with code loops and with each other

**Research loops** never collide — they overlap neither code loops nor each other, so the collision report (step 7) treats them as always safe to start.

### 3. Area resolution

For every candidate, resolve `area:` from the three legal sources in order — existing label, body declaration, the human at the review gate (see "Label contract" → "`area:` sources"). Nothing is inferred here.

Read the repo's AGENTS.md frontmatter once. If it carries a `plan-issues.areas` list, validate each resolved value against it and collect the warnings; if it does not, collect the single "unvalidated" note instead. Both are printed with the plan (step 9) — neither ever stops the run.

Candidates that reach this step with no area from source (1) or (2) are collected as the **open area questions**; the review gate answers them.

### 4. Bundle resolution

For every candidate, resolve `bundle:` from the three legal sources — existing label, body declaration, `--bundle <name>` for this run.

**A candidate with no source gets nothing: no label, no question at the gate, no warning line.** Do not count the bundle-less candidates in the summary, and do not offer to name a bundle for them. Where two sources disagree, keep the existing value and list the disagreement for the gate.

### 5. Goal, waiting-on, and the work-list

For every candidate, read its `goal:` and `waiting-on:` labels (resolved against the repo's `goal_prefix` / `waiting_prefix` — see "Label contract — `goal:` and `waiting-on:`"). `plan-issues` does **not** assign these — `/create-issue` sets the goal, and whoever discovers a block sets the waiting-on together with its note. This step only reads them.

Derive the **work-list** per goal, on read, never stored:

```
work-list(<goal>) = { issues carrying that goal } minus { issues carrying any waiting-on:* label }
```

- An issue with a `waiting-on:*` label is specified but not startable, so it is held out of the work-list and listed separately with the who/what taken from its waiting-on note.
- An issue with no `goal:` label — a repo that has not opted into the goals vocabulary, or an issue created before it — is reported under "no goal" rather than dropped. The human decides at the gate whether it belongs in this run.

This work-list is the actionable output of the skill: the issues a human can pick up right now. It is derived on read and written nowhere — there is no stored "ready" label to go stale when a blocker clears.

### 5b. Feature grouping and the size note (conditional)

**Only when the repo's AGENTS.md declares `strategy.feature_axis`.** No block → skip this step entirely: no grouping, no count, no note, and the plan output (step 9) is exactly what it is without the axis.

1. **Resolve the prefix** from `strategy.feature_axis.prefix` (default `feature:`) and read each candidate's feature label against it — see "Label contract — `feature:` (canonical)". This step only reads: `plan-issues` never assigns a feature label and never asks for a missing one.
2. **Group the work-list by feature** within each goal group. Candidates carrying no feature label are listed together under `no feature` — reported as they are, never guessed at.
3. **Count the open issues per feature**, across the repo rather than across this run's filtered candidate set, so the count does not swing with `--milestone` / `--label`:

```bash
gh issue list --repo <slug> --state open --label "feature:admin-ui" --json number --jq 'length'
```

4. For every feature whose count is **greater than `flag_over`** (declared in `strategy.feature_axis`), print one line in the size-note block of the plan output:

```
feature:admin-ui: 12 open — is the decomposition intended?
```

**This is a note, never a STOP.** It does not stop the run, does not withhold `ok` at the review gate (step 10), and is not a warning that has to be dismissed or waived. A feature with many open issues is very often simply a feature being worked on — a legitimate state. The note exists so a human *looks*, and "yes, intended" is a complete and correct answer to it. Unmanageable size is caught one altitude lower, at the issue, by the epic trigger in `skills/create-issue/SKILL.md`, not by a per-feature issue count. Rationale: `docs/adr/0008-strategy-block.md` §2.

If a declared `feature_axis` carries no `flag_over`, the grouping still happens and no size note is printed at all.

### 6. Dependency and blocked-label check

For each issue, parse `depends on #X` / `blocked by #X` references in the issue body or labels:

1. **Open dependency:** issue A depends on issue B, and B is still open → A cannot be started yet. It is reported in the start-time collision report (step 7.3), and a `waiting-on:<B>` label with a note is the durable way to record it (see "Label contract — `goal:` and `waiting-on:`").
2. **Stale blocked label:** if the issue carries a `blocked` label but the referenced blocker issue is already CLOSED → remove the `blocked` label and note the cleanup in the plan output (do not silently ignore stale labels).

```bash
gh issue view <blocker-num> --repo <slug> --json state --jq '.state'
```

### 7. Start-time collision report

**Written nowhere.** This report is printed with the plan and addressed to the human about to start work — it is not a label, not an issue comment, not a file. It describes the repo as it is at this second, and the next merge invalidates part of it. A report is read once and thrown away; a label is trusted long after it stopped being true. That asymmetry is the whole reason this is not a label.

It names what would block a **start right now**, in descending order of reliability.

#### 7.1 Open PRs touching the same paths (checkable — the binding constraint)

The only finding here that can be verified against reality, because a PR has a real diff:

```bash
gh pr list --repo <slug> --state open --json number,title,headRefName --limit 100
gh pr diff <num> --repo <slug> --name-only
```

Intersect each open PR's **actual changed paths** with each candidate's declared files. Report per candidate, naming the PR number and the overlapping paths, with the two ways out:

```
#42  overlaps open PR #61 (src/auth/refresh.ts)
     → start after #61 merges, or accept a stacked branch off its head
```

- **State the asymmetry.** The PR side is fact; the candidate side is still a declaration. So a *reported* overlap is reliable, and a *missing* one is not proof of safety — an issue whose `## Files to Touch` is wrong can still collide.
- A PR whose diff cannot be fetched (fork, permissions, deleted head) is reported as **unchecked** with the reason, never silently dropped. An unchecked PR is not a clean PR.
- A candidate with no `## Files to Touch` section cannot be checked against any PR. Say so on its own line rather than reporting it as clear.

#### 7.2 Declared file overlap between candidates (a hint)

Two candidates whose declared files-to-touch sets overlap would collide if started at once. This is a real signal, but a weak one — print the caveat **in the output itself**, not only here in the docs — the person reading the plan is the one who needs to know how much the line is worth:

```
Declared overlaps (hint — from "## Files to Touch", which may be wrong):
  #44 ∩ #48   api/schema.yaml
```

Check the declared path over `gh`, against the slug — the primary `--repo owner/slug` form has no local checkout, and nothing else in this skill touches a filesystem:

```bash
gh api "repos/<slug>" --silent                     # probe once: exit 0 = repo reachable
gh api "repos/<slug>/contents/<path>" --silent     # exit 0 = exists, exit 1 = 404 = missing
```

**The repo probe is not optional.** An unreachable repo answers every path with the same 404 as a missing file, so without it a permissions or slug error is reported as every declared path being wrong.

A declared path that does not exist in the repo is reported on its own line:

```
  #47 declares app/retrieval/gates.py — no such path in the repo
      (a file to be created, or a wrong guess — the issue does not distinguish)
```

Skip this check for paths the issue marks as new (a `### NEW` sub-header or a "NEW:" annotation in the `## Files to Touch` list). A path that is *meant* not to exist is not a finding.

Every other failure is reported as **unchecked** with the reason, never omitted — an unchecked path is not a verified path, the same rule as 7.1. `gh` exits 1 on any API error and names the status in its message, so only `(HTTP 404)` **after a passing repo probe** means missing; a failed probe, or any other status, is unchecked:

```
  #47 declares app/retrieval/gates.py — unchecked (gh: Bad credentials (HTTP 401))
```

#### 7.3 Explicit dependencies (not demoted)

The `depends on #X` / `blocked by #X` edges already parsed in step 6, reported as-is: a candidate whose blocker is still open cannot be started, whatever the file analysis says.

#### Why the declared overlap is a hint and `depends on` is not

Without this, the design looks inconsistent — both are things an author typed into an issue body, and only one of them is discounted. The difference is what they are typed *about*:

> A file path is a **guess about a fact that lives in the repo**. There is a ground truth, so the guess can be wrong — and silently is. In the run that motivated this change, two issues declared `app/retrieval/gates.py`; the code was in `app/retrieval/pre_gates.py`.
>
> A dependency is a **decision only the author holds**. There is no ground truth beside it for it to disagree with.
>
> Declared data is unreliable exactly when a truth exists elsewhere.

That is also the rule for anything added to this report later: if the claim has a checkable counterpart in the repo, check it and report the check — do not report the claim.

### 8. Priority sort

Sort the work-list by priority signal:

1. Explicit `priority:high` / `priority:medium` / `priority:low` label — in that order.
2. Tie-break: lower issue number first (older issues first).

### 9. Plan output

Print the plan as a human-readable draft — the work-list grouped by goal (and, where the feature axis is declared, by feature within each goal), the resolved labels, the held-out blocked issues, the feature size notes from step 5b, the gate state where the repo declares `strategy.gates`, and the start-time report from step 7:

```
Plan — Domek-Labs/stagecrew (7 issues)
─────────────────────────────────────────────────────

Work-list — goal:public-launch (3 startable)
  feature:admin-ui (2)
    #42  feat: add JWT refresh endpoint        [code]    priority: high   area:auth      bundle:beta-v1
    #44  fix: race condition in scheduler      [code]    priority: medium area:ops
  no feature
    #51  research: benchmark ollama tool-use   [research]                 area:retrieval

Work-list — goal:reliability (1 startable)
  feature:admin-ui (1)
    #50  feat: add refresh-token rotation UI   [code]    priority: medium area:admin

Held out — blocked (not startable)
  #45  feat: update API schema for JWT fields  [code]    waiting-on:42    (needs #42 merged — see issue note)

No goal
  #53  research: compare migration strategies  [research]                 area:ops

Feature size (note only — never a STOP; flag_over: 10)
  feature:admin-ui: 12 open — is the decomposition intended?

Strategic gates (AGENTS.md strategy.gates) — state only, nothing enforced here
  architecture_adr: on   component_reuse: on   test_evidence: on   documentation: off

── Start-time report (not written anywhere; true as of now) ──────────────

Open PRs overlapping a candidate (checked against the PR's real diff):
  #42  overlaps open PR #61 (src/auth/refresh.ts)
       → start after #61 merges, or accept a stacked branch off its head
  #50  open PR #63 could not be diffed (fork — no read access): unchecked

Declared overlaps (hint — from "## Files to Touch", which may be wrong):
  #44 ∩ #48   api/schema.yaml
  #47 declares app/retrieval/gates.py — no such path in the repo
      (a file to be created, or a wrong guess — the issue does not distinguish)

Blocked by an open dependency:
  #45  depends on #42 (open)

──────────────────────────────────────────────────────
Stale blocked labels removed: #46 (blocker #39 is CLOSED — label removed)
Warnings: #50 area "admin" is not in AGENTS.md plan-issues.areas — accepted
Ignored labels: area:Retrieval (does not match the area: grammar)
Missing area: #47, #53 — answer before confirming

Confirm this plan? [ok / area <num> <name> / skip-area <num>[,<num>...] / adjust <description> / cancel]
```

When AGENTS.md declares no `plan-issues.areas`, replace the per-issue area warnings with the single line:

```
note: no plan-issues.areas declared in AGENTS.md — area: values are unvalidated
```

When AGENTS.md declares no `strategy.feature_axis`, the output carries **no feature sub-headers and no size-note block** — the work-list is printed grouped by goal exactly as it is above without them.

**The gate-state block follows the same rule.** It is printed **only** when AGENTS.md declares `strategy.gates`; with no block the output is exactly what it is without it — no line, no header, no placeholder. What is printed is **state, not judgement**: one `on` / `off` per declared gate, read straight from the block, so a reader of the plan sees which strategic dimensions the repo has switched on before any loop starts. A gate that is not declared at all is omitted from the line rather than printed as `off`.

`/plan-issues` deliberately does **not** evaluate whether a gate's underlying mechanism is configured. That check, its per-gate definition of "unconfigured" and its report wording are canonical in `skills/work-issue/SKILL.md`, section "Optional `strategy.gates` consistency report", and belong to the pre-flight of the run that would act on them — repeating them here would put the same rule in two files and let them drift. What each gate injects at issue-creation time is likewise owned elsewhere, by `skills/create-issue/SKILL.md`, section "Strategic Gates".

Note what is **not** in this output: no line about candidates that have no bundle. That is the normal state of an issue, and reporting it would train the reader to ignore the report. The feature size note is likewise not an entry in the "Missing …" or "Warnings" lines — it is a question addressed to a human, not a defect to clear before `ok`.

### 10. Human review (mandatory gate)

Wait for explicit confirmation:

- **`ok`** → write the labels (see below) and exit. Not accepted while the "Missing area" list is non-empty — answer with `area` or `skip-area` first.
- **`area <num> <name>`** → set the area for one candidate; repeatable. This is the third legal `area:` source and the only one the skill itself can offer.
- **`skip-area <num>[,<num>...]`** → the human declines to name an area for those issues. They get no `area:` label and are listed as skipped in the final summary. An unanswered question is never resolved by guessing.
- **`adjust <description>`** → re-run the plan with the adjustment applied. Adjustments can be: "narrow to goal:public-launch", "include the no-goal issues", "remove #47 from plan".
- **`cancel`** → exit without writing any labels.

The gate is also where a conflict from steps 3 – 4 is settled: two `area:` labels on one issue, or a `--bundle` value disagreeing with an existing `bundle:` label. Present the conflict, take the answer, never resolve it silently.

**This gate is mandatory.** `plan-issues` never starts work automatically.

### 11. Label writing (after confirmation)

Two labels, written in this order. Create each repository label if it does not exist yet, then attach it. `plan-issues` writes only `area:` and `bundle:` — it does **not** write `goal:`, `waiting-on:` or `feature:` (the goal and the feature are set at creation, the waiting-on by whoever discovers a block; see the three "Label contract" sections).

**`area:<name>` — on every candidate that has one.** After step 3 and the review gate, that is every candidate except those the human explicitly skipped.

```bash
gh label create "area:retrieval" --repo <slug> --color 1D76DB --description "Subject area" --force
gh issue edit <num> --repo <slug> --add-label "area:retrieval"
```

**`bundle:<name>` — only where a source existed.** No source, no call: an issue with no bundle is skipped here in silence.

```bash
gh label create "bundle:beta-v1" --repo <slug> --color FBCA04 --description "Ships together" --force
gh issue edit <num> --repo <slug> --add-label "bundle:beta-v1"
```

An issue that already carries the label it would be given is left alone — `gh issue edit --add-label` is idempotent, but re-issuing it on every plan run buries the real writes in the log.

Grammar, lifetime and the source rules for both labels are in "Label contract" above — the canonical definition, in this file.

## Diff guard (hard gate for work-issue integration)

`plan-issues` documents a **diff guard** heuristic that `/work-issue` Critic stages should apply:

> If a loop's diff has **deletions > 3 × additions AND total changes < 100 lines**, the Critic should flag it as "suspicious diff pattern — likely operating on stale base branch" and request a REVISE with `git rebase <default_branch>` before re-review.

This catches the failure mode where a loop started on a stale branch and silently removed content that was added after its branch point. The Critic is the right stage to enforce this (it has the full diff).

Include this note in the plan output if any planned issues are code loops.

## What this skill does NOT do

- Does not create branches
- Does not write code or start work
- Does not merge PRs
- Does not auto-start `/work-issue` — that requires a separate invocation
- Does not resolve architectural conflicts (only file-level overlap, and only as an advisory hint)
- **Does not invent a `bundle:` name.** A bundle is a release decision; without one of the three sources the issue simply has no bundle
- **Does not infer `area:`** from touched files, titles or diffs — a human names it, or AGENTS.md's vocabulary does
- **Does not assign `goal:` or `waiting-on:`** — it reads them; `/create-issue` sets the goal, whoever discovers a block sets the waiting-on
- **Does not assign `feature:` and never STOPs on feature size** — it reads the label, groups by it and prints the `flag_over` note; `/create-issue` sets the label, and the note is a question for a human, never a block
- Does not write the start-time report anywhere — no label, no comment, no file (step 7)
- Does not remove an `area:` or `bundle:` label, and does not rename a non-conforming one

## Output labels consumed by other skills

| Label | Set by | Consumed by |
|-------|--------|-------------|
| `area:<name>` | `/create-issue` (at creation), `/plan-issues` (step 11) | humans filtering the backlog by subject — no skill branches on it |
| `bundle:<name>` | `/plan-issues` (step 11, only from an existing source) | humans and release tooling — no skill branches on it |
| `feature:<name>` | `/create-issue` (at creation, only where `strategy.feature_axis` is declared) | `/plan-issues` (grouping + the `flag_over` size note); humans reading the backlog per building block |
| `loop-type:<type>` | `/create-issue` | `/plan-issues` (classification), `/work-issue` (brief dispatch) |
| `found-in-loop` | `/create-issue` (at creation, only via `--from-loop <issue>`) | humans distinguishing a redirected finding from work planned from scratch — no skill branches on it |

Contract for `area:` / `bundle:`, for `goal:` / `waiting-on:`, for `feature:`, and for `found-in-loop`: the four "Label contract" sections above (canonical, in this file).

## See also

- `skills/create-issue/SKILL.md` — genesis phase (creates issues, sets `area:`, `goal:`, `feature:` and, via `--from-loop`, `found-in-loop` at creation)
- `skills/init-agents/SKILL.md` — bootstrap phase (offers the optional `plan-issues.areas` and `plan-issues.goals` blocks)
- `skills/init-agents/references/AGENTS.md.template` — the one permitted copy artifact of the `plan-issues:` block shape
- `skills/work-issue/SKILL.md` — execution phase (drives individual issues; reads `waiting-on:`)
