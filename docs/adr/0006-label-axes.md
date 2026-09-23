# ADR 0006 — goal + waiting-on issue-label axes, with configurable prefixes

**Status:** accepted
**Date:** 2026-08-27 (amended 2026-08-28, #84 — wave retirement)
**Issue:** #83, #84
**Supersedes:** the wave-assignment mechanism formerly implemented in `skills/plan-issues/SKILL.md` (it predated this ADR practice, so had no dedicated record of its own; the amendment below retires it). **Amends:** adds the `goal:` / `waiting-on:` contract beside the `area:` / `bundle:` one in `skills/plan-issues/SKILL.md`, and an optional `plan-issues.goals` block to the AGENTS.md schema.

## Context

Issue labels drift because the loop never asked the two questions that make a backlog actionable: **what goal does an issue serve**, and **what does it wait on**. `/create-issue` mandated only `loop-type:`; goals and blockers were captured ad-hoc, and AGENTS.md carried no label schema a skill could read.

A field stock-take of 47 open issues after four months made the failure concrete: `blocked` on 40% of them with no record of what they waited on; near-duplicate labels (7 of 8 overlapping); a label used by nothing; one issue carrying a `loop-ready` marker **and** `blocked` at once; and a derived "work-list" label that went stale because it stored an inference that had to be re-maintained.

The area/bundle contract (ADR pattern already established) showed the shape of the fix — a contract in the skills, the vocabulary in AGENTS.md — but did not answer actionability.

## Decision

**Introduce two orthogonal issue-label axes, additively, opt-in per repo via `AGENTS.md`.** No behavior changes unless a repo declares the vocabulary. At the time of the #83 decision the wave mechanism was left untouched — retiring waves in favour of these axes was a deliberate follow-up, now recorded in the amendment below (#84).

### 1. Two axes, not one

- **`goal:<value>`** — exactly one per issue when opted in. "What cannot be reached without this issue." Values are project-defined in `plan-issues.goals`; no goal name is hardcoded.
- **`waiting-on:<value>`** — zero or one. "What blocks this right now." A `waiting-on:` label **without a recorded who/what is worthless**, so whoever sets it writes the who/what into the issue (for a dependency, the blocking issue number).

They are orthogonal because an issue can be fully specified and still not startable. Collapsing them into one label is what produced the `loop-ready` + `blocked` contradiction.

### 2. The work-list is a query, never a label

The set of actionable issues for a goal is `<goal>` **minus** every issue carrying `waiting-on:*`, computed on read. The stale "work-list" label in the field data is exactly what a stored inference becomes; the query cannot go stale. No third derived label is added — a third axis belongs in a comment, not a maintained label.

### 3. The check-question separates goal from urgency

A goal names what an issue *serves*, not how soon it is wanted. `/create-issue` prints, at the goal step:

> **What happens if we try to reach the goal WITHOUT this issue?**

If the goal is still reached without the issue, the issue does not belong to that goal — it is urgency wearing a goal label. This is the disambiguation that keeps `goal:` from rotting into a priority label.

### 4. Configurable prefixes keep the plugin English-only

The two prefixes are read from `AGENTS.md` (`goal_prefix` default `goal:`, `waiting_prefix` default `waiting-on:`). Nothing German — nothing at all — is hardcoded in the skills, so a project keeps its own vocabulary in its own language (the originating project uses `ziel:` / `wartet:`) while this public repo stays English-only. Every rule is written against the resolved prefix. The `waiting-on:` pre-flight STOP therefore applies even to a repo that declares no `goals` vocabulary, because the prefix has a default.

### 5. Canonical home and per-skill behavior

The contract is canonical in **`skills/plan-issues/SKILL.md`**, beside the `area:` / `bundle:` contract — one file, per the single-source hard-gate. `create-issue`, `work-issue` and `init-agents` link to it and never restate it. The vocabulary sits in the **`plan-issues:`** namespace (beside `areas`), not `work-issue:`, because both are the repo's issue vocabulary.

- **`init-agents`** — offers the `goals` block; creates the `goal:*` labels only when it is set.
- **`create-issue`** — a single-select goal question with the check-question, only when the block exists; optionally warns on a ready marker + `waiting-on:*` together.
- **`work-issue`** — a pre-flight STOP on any `waiting-on:*` label, at the same severity tier as a missing AGENTS.md.

### 6. A superseded label is never deleted

Retiring or renaming a goal **never deletes the old `goal:<value>` repository label** — a deleted label silently strips itself from every issue that carried it, destroying a valid historical reference. A retired goal is dropped from the `goals:` vocabulary (so it stops being offered) and left in place on GitHub. Any check that lists or counts issues by a possibly-retired label queries with `--state all`, so a closed issue's goal is still seen.

## Consequences

**For existing users:** no field to set. With no `plan-issues.goals` block, `/create-issue` asks no goal question, `/init-agents` creates no goal labels, and every skill behaves exactly as before. The one always-on addition is `/work-issue`'s `waiting-on:*` pre-flight STOP — but it fires only on an issue that actually carries a `waiting-on:*` label, which no pre-existing issue does until someone sets one; an unblocked issue is unaffected.

**For a repo opting in:** goals become a controlled single-select vocabulary, blockers become an explicit label with a mandatory note, and the actionable backlog is a query anyone can run. The `goal:` value is not branched on by any skill today — it exists for filtering and the work-list query.

**Not covered by the #83 decision:** priority (a separate axis, deliberately not folded into `goal:`). Wave retirement was left to the follow-up recorded in the amendment below (#84).

## Migration

None required. To opt in, add to `AGENTS.md`:

```yaml
plan-issues:
  goals: ["public-launch", "cost-down", "reliability"]
  goal_default: "public-launch"    # optional
  goal_prefix: "goal:"             # optional; default goal:
  waiting_prefix: "waiting-on:"    # optional; default waiting-on:
```

To back out, remove the `goals` key. Existing `goal:*` labels are left in place (rule 6).

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). New AGENTS.md field plus new backwards-compatible skill behavior: no field is required, no schema is reinterpreted, and an absent block preserves today's behavior. Not `patch` — in this plugin the Markdown is the runtime, and this adds a pre-flight STOP and label-creation steps the skills did not previously run. Not `major` — no default is flipped and no caller breaks; under 0.x there is no `major` bump in any case.

---

## Amendment (2026-08-28, #84) — retire the wave mechanism

**Status:** accepted. **Issue:** #84 (depends on #83, above). Extends this ADR rather than opening a new number, because it is the same decision seen through: the two axes introduced above become the planning output, and the mechanism they replace is retired here.

### Context

The #83 decision above deliberately left the wave mechanism in place. `plan-issues` partitioned the open issues into parallel-safety **waves** and stamped a `wave:<n>` label on each, so `/work-issue` loops could run concurrently without file collisions, migration-number clashes, or dependency-order violations, and `/close-out` merged the resulting PRs in wave order. With `goal:` + `waiting-on:` now carrying prioritisation and blocking, the wave labels are the last piece of the two-question backlog they were the wrong answer to.

A field stock-take in #75/#76 made the case concrete: across **208 issues in these repos, `wave:` labels never existed — 0 of 208**. The partition was computed from each issue's declared `## Files to Touch`, the least reliable input the skill has (an author's guess about a fact that lives in the repo, and silently wrong when it disagrees — the motivating run declared `app/retrieval/gates.py` for code that was in `app/retrieval/pre_gates.py`). The constraint that actually binds at start time is not loop concurrency but **open-PR overlap**, which has a real diff to check against. The wave label froze an unreliable, time-dependent guess into a durable label that was trusted long after it stopped being true.

### Decision

**Retire wave production.** `plan-issues` stops assigning `wave:<n>` and becomes the backlog planner whose output is the actionable **work-list** — `<goal>` minus every issue carrying `waiting-on:*` — for human review. The wave-assignment workflow (the two competing partition algorithms noted in #52, the per-wave migration-number reservation, the graph-coloring partition) is removed.

1. **The accepted collision-safety trade-off.** Waves and the two axes solve *different* problems, and the swap loses one thing on purpose. Waves were the parallel-**execution-safety** unit (file-overlap and migration-number partitioning for concurrent loops); `goal:` / `waiting-on:` are backlog **prioritisation and blocking**. Retiring waves therefore gives up **automatic parallel-execution sequencing** — nothing now computes a safe concurrent batch order. That loss is accepted and recorded here, not hidden. It is cheap because the sequencing was computed from unreliable declared file paths and, per the field evidence, was never actually used.

2. **The useful non-label part is kept.** The **start-time collision report** — open PRs whose *real* diffs overlap a candidate, with declared-file overlap demoted to a clearly-caveated hint — stays, exactly because it is a throwaway, human-read output rather than a label. It answers "what would block a start right now" against checkable ground truth (the PR diff) and is read once and discarded, so it cannot rot the way a `wave:<n>` label did. This is the retained, non-label answer to the parallel-safety question.

3. **Retire the labels in place — never delete them.** `wave:1` / `wave:2` / `wave:3` are **left on GitHub**, unassigned going forward. They may sit on closed issues, and deleting a label silently strips it from every issue that carried it, destroying which issues belonged to which historical run — the same rule as the superseded-goal rule (§6 above). The skills simply stop writing them.

4. **`close-out` is out of scope.** `/close-out` also consumed the wave order, but it is currently unused and slated for a separate decision (descope the skill entirely, or fix its merge order per #77). #84 removes only wave *production* and the residual references in `plan-issues` / `work-issue` / `loop` / `run-loop` / `README` / `CLAUDE` / this repo's `AGENTS.md` label section; it does **not** touch `skills/close-out/SKILL.md`, and it leaves the AGENTS.md single-source pointer to the `wave:<n>` contract (which lives in `close-out`) intact until that decision lands. This keeps #84 free of overlap with #77.

### Supersession

This amendment **supersedes the wave-assignment mechanism** that `plan-issues` implemented (which had no ADR of its own — it predated this practice) and the wave-based planning references throughout the pipeline docs. The incidental wave mentions in the historical ADRs 0003 / 0004 / 0005 are left as records and not rewritten; the live `wave:<n>` contract in `skills/close-out/SKILL.md` is likewise left in place, pending the separate `close-out` decision.

### Version

Ships as **`minor`** under `version_policy`. It is a deliberate, documented **default flip** — the planner no longer produces waves — which under 0.x ships as minor provided (a) an ADR records the flip (this amendment) and (b) a migration path exists. The migration path is the `goal:` + `waiting-on:` scheme introduced in #83: the actionable backlog is now the work-list query rather than a wave partition. No opt-in restores wave production, and none is required — the field evidence is that no repo relied on it. Not `major`: under 0.x there is no `major` bump, and the minor rule's ADR-plus-migration test is met.
