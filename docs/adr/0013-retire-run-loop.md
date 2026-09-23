# ADR 0013 — the `run-loop` skill is removed: an unused wrapper that was a pure description surface

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #102
**Amends:** deletes `skills/run-loop/`; removes the references in `skills/loop/SKILL.md` (which becomes a four-way router), `skills/plan-issues/SKILL.md`, `skills/work-issue/SKILL.md` and `CLAUDE.md`. Supersedes, **by note and without editing them**, the `run-loop` mentions in ADRs 0003, 0006 and 0007.

## Context

`/run-loop` was the single-command entry point to the pipeline. It chained `create-issue → plan-issues → [human gate] → work-issue` and did nothing else. Two facts decided its fate.

**It was never used.** Every loop this repo has run — its own and its consumers' — was driven by calling `/create-issue` and `/work-issue` directly, with `/plan-issues` in between when several issues were in flight. The one command it saved was saved for nobody.

**It carried no logic of its own.** Its 144 lines were, in substance, a description of what the three chained skills already do: the batch-mode behaviour of `create-issue`, the work-list and the start-time collision report of `plan-issues`, the terminal verdicts of `work-issue`. The chaining itself is three sentences; the rest was restatement.

That combination is the expensive one. A file that describes other files must be kept true whenever those files change, and it earns nothing back when they do not. The evidence is in this repo's own history: `run-loop` was rewritten twice for changes it contributed nothing to — the wave retirement (#84) and the close-out descope (#85). Both times the edit existed only to stop the file from describing a pipeline that no longer existed. Neither time did `run-loop` have a stake in the decision.

The alternative to removal was to leave it and keep paying. That is the status quo, and its cost is not the maintenance minute — it is that the file goes stale silently. A description surface nobody invokes is never exercised, so an out-of-date `run-loop` is discovered by a reader, not by a run. Two of the three ADRs that mention it (0006, 0007) mention it precisely in a list of files that had to be swept.

Keeping it "in case someone wants the shortcut" was considered and rejected. The shortcut is available without the skill: `/create-issue` then `/work-issue` is two commands, and `/loop` already routes a user who does not know which of them they need.

## Decision

**`skills/run-loop/` is deleted, and every live reference to it is removed. The chaining behaviour is not relocated anywhere.**

After this change the plugin ships **six** skills: the four pipeline phases `init-agents`, `create-issue`, `plan-issues` and `work-issue`; the routing umbrella `loop`; and the reference skill `github`, which is a convention source rather than a pipeline phase.

### 1. Removed, not relocated

There is no replacement wrapper, no `--chain` flag on `create-issue`, and no hidden fallback that still runs the sequence. A user who wants the old behaviour runs the two commands. Relocating the chaining would reproduce the exact defect this ADR removes — a second surface describing what three other skills do — under a different filename.

### 2. `loop` becomes a four-way router, and it keeps the distinction it already drew

`skills/loop/SKILL.md` carried nine of the fifteen live references: the routing table, the pipeline diagram, the typical-sequence note, the numbered route menu, the when-to-use table, the example block, the "why an umbrella" list, the See-also and its own frontmatter description. All nine are gone; the umbrella now routes to the four pipeline phases.

Three further statements in that file were **counts**, invisible to a `run-loop` grep and wrong the moment the skill was gone: "Five sub-skills cover the full lifecycle", "routes to one of the six sub-skills" (already wrong before this change) and "Five sub-skills, one umbrella". All three now read "four", and the same correction is made to `CLAUDE.md`'s `## The 5 Skills` heading. This is worth recording because it is the general shape of the problem: a description surface fails a text search for the thing it describes, and the check that catches it is a reader, not a grep.

`github` stays out of the phase count. It is a reference skill, and `CLAUDE.md` and the `loop` See-also both say so explicitly rather than folding it into the pipeline.

### 3. The historical ADRs are superseded by note, not edited

ADRs 0003, 0006 and 0007 mention `/run-loop`. None is edited.

- `0003-model-selection.md` (line 145) lists it among the non-loop skills whose model selection is "a separate issue if wanted".
- `0006-label-axes.md` (line 103) names it in the sweep list for the wave retirement.
- `0007-descope-close-out.md` (line 40) names it in the sweep list for the close-out descope.

Each is a dated record of a decision taken while the skill existed, and each was accurate on the day it was written. Rewriting them would falsify the record — it would make the repo claim that the wave and close-out sweeps touched a set of files they did not touch. **This ADR is the supersede-by-note**: from here on, any reference to `/run-loop` in ADRs 0003, 0006 or 0007 is historical, and the skill it names does not exist. That is the same handling ADR 0007 received for ADRs 0004 and 0005.

The `0003` mention is the one worth naming separately, because it is forward-looking rather than purely retrospective — it defers a possible future feature for a skill that is now gone. The deferral is simply moot; the note covers it, and editing a dated ADR to remove a moot line is not worth the precedent.

### 4. `README.md` is unchanged, and that was verified rather than assumed

The issue's Files-to-Touch listed `README.md` for "the skill list, pipeline diagram". It has **zero** `run-loop` references: its skill list never named the command and it carries no pipeline diagram. No edit was invented to satisfy the entry. It is recorded here as checked.

## Consequences

**For the repo:** one skill directory and fifteen live references disappear; four counts are corrected. Every future pipeline change has one fewer file to sweep, and the file it no longer has to sweep is the one with no stake in the outcome.

**For a user:** `/run-loop` stops resolving. The path it wrapped is documented where it pointed — `skills/loop/SKILL.md` states in its typical sequence and its when-to-use table that the steps are called one at a time, and `CLAUDE.md`'s quickstart says the same. A `claude restart` is required after the merge, as after any `SKILL.md` change; until the plugin cache reloads, a stale cached `run-loop` may still resolve.

**For a consumer repo:** nothing changes. No AGENTS.md field is added, removed or reinterpreted, no default is flipped, and no loop that was ever actually run used the removed command.

**Accepted cost, stated plainly:** anyone who did use `/run-loop` types two commands instead of one and confirms the plan at `/plan-issues` rather than at a gate inside the wrapper. There is no migration path, because there is nothing to migrate to — see Migration.

**A boundary, stated so it is not read as an omission.** The critique in this ADR — a description surface that must be kept true and contributes no logic — applies with less force to `/loop` itself, which restates each sub-skill's purpose and triggers and had already drifted to a wrong count. `/loop` is deliberately **kept and not restructured here**. It has a job `run-loop` did not: it is the entry point for a user who does not know which skill they need, and that value does not depend on any of the skills it routes to. Whether it should be slimmed is a separate decision and belongs in its own issue.

## Migration

None, and none is possible. `version_policy.major` requires a breaking change under 0.x to ship with an ADR **plus** an opt-in that keeps the old behaviour available — "or, where an opt-in is genuinely impossible (e.g. a removed skill), record that impossibility in the ADR and ship as minor".

**An opt-in path for `/run-loop` is impossible by construction.** The old behaviour is a skill file; there is no flag, field or default that can make a deleted file resolve again. Keeping the file behind an opt-in is not an opt-in, it is not removing the skill — and the whole cost this change removes is the cost of the file existing. This paragraph is what makes the minor bump legal under the policy, not a formality.

For a consumer repo the migration is empty: no AGENTS.md edit, no configuration change, no re-bootstrap. Replace any `/run-loop "<idea>"` in a personal note or script with `/create-issue "<idea>"` followed by `/work-issue <num>`, with `/plan-issues` in between when several issues are created.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). A shipped skill is removed, which `version_policy.major` names as a breaking change — and which the same clause routes back to `minor` under 0.x, given this ADR and the recorded impossibility of an opt-in. Not `patch` — in this plugin the Markdown is the runtime, and a command that resolved no longer does. Not `major` — under 0.x there is no major bump; the leading zero is the compat signal and moving it is reserved for `first_stable_bump`.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this is a behaviour change to a skill, the same self-application ADRs 0009 to 0012 record.
