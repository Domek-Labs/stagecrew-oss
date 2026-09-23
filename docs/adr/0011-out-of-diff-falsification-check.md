# ADR 0011 — the Critic gains a standing out-of-diff falsification check: a behaviour change is searched for the statements it falsified

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #67
**Amends:** the Stage 4 (Critic) briefing in `skills/work-issue/SKILL.md` — the stage gains a step and its later steps are renumbered. Supersedes nothing.

## Context

The Critic is the only stage of the loop with a demonstrated catch rate: across #23, #25 and #26 it returned REVISE three times out of three, each time on a defect that the Validator, the Implementer **and** the Tester had already passed. That record is what makes its **scope** the most expensive constraint in the pipeline — whatever the Critic does not read, nothing reads.

Its briefing scoped it to the change: read the diff, then per-AC evidence, out-of-scope, hard gates, code quality. Every step is a read of the diff. Nothing in the loop ever reads what the diff *contradicts*.

The removal of the `close-out` skill (ADR 0007) is what that costs. A whole skill was deleted, a declared field (`merge_policy`) was dropped and a terminal verdict (`ready-for-close-out`) ceased to exist. The diff touched the skill files and the narrative files it knew about; statements elsewhere kept describing all three, and reached the default branch as documentation of behaviour that no longer existed. The audit that found them was run by hand, by a human, after the fact — by no stage of the loop.

Patching those sentences one at a time does not change the procedure that let them through. Without a procedure change the next default- or behaviour-changing PR reproduces the outcome, and the only reason it would not is that someone happens to remember.

Three constraints bound the design, and each one rejects an obvious answer:

- **A new terminal verdict would be a second gate on the same axis.** The Critic already routes work back to the Implementer under a hard cap of three revises; a fourth verdict would have to define its own exhaustion behaviour, its own claim-release path and its own resume semantics, all to express something the existing REVISE already expresses.
- **An unconditional repo-wide grep would be paid on every loop.** Most diffs change no default and no documented behaviour. A search that runs regardless is a per-loop token cost whose expected yield on those diffs is exactly zero, and a check that is expensive on the common path is a check that gets disabled.
- **A silent skip is indistinguishable from a forgotten step.** The failure mode this ADR is about is precisely a check nobody ran. A step that leaves no trace when it finds nothing to do recreates that failure mode inside the fix.

## Decision

**The Critic runs an out-of-diff falsification check on every run, as a standing step of its briefing. It classifies the diff first, and searches the repo only when the classification says the diff could have falsified something.**

The full procedure is canonical in `skills/work-issue/SKILL.md`, section "Out-of-diff falsification check". This ADR records the decision and its shape, not the procedure.

### 1. Placement: beside the other scope check, ahead of the config-dependent ones

The step is inserted as **stage 4 step 6**, immediately after the out-of-scope check, and the three steps that followed are renumbered. It is a scope check — it asks what the change reaches that the diff does not show — so it belongs beside the other scope check rather than behind the `hard_gates` pass, which is conditional on what the repo happens to declare. A check that only runs after a repo-config-dependent step inherits that step's conditionality by accident.

### 2. Classify first, search second — and record the classification either way

§1 asks one question, verbatim, with four enumerated triggers: does the diff change a default, a terminal verdict, the semantics of a declared field, or a documented behaviour? A `no` writes the `n/a` line and stops there; a `yes` runs the search.

This is what makes the check affordable. It is also what makes it auditable: the `n/a` line is written on **every** `no` run, and a rendering that omits it is not acceptable. The line costs one sentence and buys the distinction between "ran, nothing to do" and "not run" — which is the exact distinction whose absence produced the problem.

### 3. The exclusion is by the hit's own path, never by the hit's text

The search filters out hits found **in files the diff changed** — those are reviewed by the ordinary diff read — and it does so by comparing the grep output's path field, not by matching the changed paths anywhere in the output line.

This is not a stylistic preference; the alternative is silently wrong. Prose in this repo routinely *cites* the file whose behaviour it describes, and a pointer sentence naming a changed file is the single most likely sentence for a behaviour change to falsify. A text-level filter deletes exactly those hits, leaving a clean report over the population the check exists to find. It also over-matches by path prefix. The path-field comparison is exact and reports what a text filter would have hidden.

### 4. Terms have a quality floor, because a term with no floor is not implementable

A term qualifies when it is identifier-like or a quoted multi-word string drawn from the diff — a changed field name, a verdict string, a command name, a flag, a named default value, a label grammar, a renamed section title. Bare English words, bare booleans and bare numbers are excluded: they match most of the repo and bury the real hits under noise, which is functionally the same as not running the check.

A term that returns an unreadable hit count is **narrowed and the narrowing is stated**, never dropped in silence. Same principle as §2: the record of what the check did is part of the check.

### 5. The fence is file-level

A hit inside an ADR or another dated record is **historically fenced** — the repo already keeps superseded ADRs in place as historical records rather than editing them, and ADR 0007 says so explicitly for ADRs 0004 and 0005. The fence test is therefore the *file*, not a disclaimer sentence inside it: ADR 0004 still carries `Status: accepted` and a canonical-source note pointing at a section that no longer exists, and it is fenced regardless, because it is an ADR.

Making the test sentence-level would have the Critic re-litigate that file on every run for as long as the repo exists. The converse is the sharp edge and is decided the other way: a hit that *claims* the fence from **outside** such a file — a live standards file describing a decision as historical — is **falsified**, not fenced.

### 6. Rejected: a new terminal verdict, and an unconditional grep

Both alternatives from the Context are rejected on the record. A falsified statement is a **REVISE item under the existing three-revise cap** — the Critic's verdict set and the cap are untouched. And the search runs only on a `yes`, over `*.md` prose, with terms drawn from the diff; a pure feature addition never reaches it.

The check is also **not** the Component-Registry dupe-detection pass and does not merge with it. They are siblings on different inputs: that pass greps the declared code globs for code duplicating the diff, this one greps Markdown for prose the diff falsified. Different globs, different finding, different remedy.

### 7. Both per-loop-type Critic criteria carry it by pointer

The `code` and `research` implementer briefs each gain **one bullet pointing at the canonical section**, and restate none of it — no copy of the classification question, the four triggers, the command or the three hit classes. The `research` bullet adds the one clause that is genuinely type-specific: there §1 is answered over the findings doc's own claims rather than over a code diff. That clause is the pointer's *scope*, not a second copy of the procedure.

This is the repo's single-source hard gate applied to the thing the gate is for. A check whose text existed in three places would drift, and the drift would be invisible in exactly the way this ADR is about.

## Consequences

**For every loop, on every run:** one classification question and one line in the Critic's stage comment. On the majority of diffs — wording, additive features, typo fixes — that is the entire cost.

**For a behaviour- or default-changing diff:** one grep over the repo's Markdown with terms taken from the diff, and a classified hit list in the stage comment. Falsified hits route back to the Implementer as ordinary REVISE items, so the repair happens inside the same loop that caused the breakage rather than in a manual audit weeks later.

**Validated against real history.** The procedure was replayed against two historical changes in this repo, both executable today:

- The `close-out` removal (the merge commit of #89, against its parent) surfaces hits only inside `docs/adr/0003`–`0006` — every one **historically fenced**, no REVISE item. The check is quiet where it should be quiet.
- The wave-mechanism retirement (the merge commit of #88, against its parent) surfaces `skills/close-out/SKILL.md` — a **live** skill file, not an ADR — still declaring the `wave:<n>` label contract and stating that `/plan-issues` creates and assigns those labels, which that diff had just falsified. Those are REVISE items, and nothing in the loop raised them at the time.

**A boundary the check does not cross, stated so it is not mistaken for a bug.** Hits inside files the diff itself touched are excluded by construction — they belong to the ordinary diff read. A stale sentence sitting in a changed file, on a line the diff did not touch, is therefore *not* this check's catch. That case is the diff reviewer's, and widening this step to cover it would make it a whole-file re-review of every changed file on every behaviour change, which is the unconditional-cost failure mode §2 exists to avoid.

**Accepted cost:** the Critic's stage comment grows, and on a `yes` run the Critic spends one grep plus a classification pass over its hits. The mitigation is the classification gate: the cost is paid by the diffs that can actually cause the damage, and by no others.

## Migration

None required, for this repo or for any consumer repo. The check reads the diff and the repo's own Markdown; it needs no new AGENTS.md field, no configuration and no opt-in, and it changes no existing field's meaning. A repo that upgrades gets the extra step and the extra line in its Critic comments, and nothing else changes.

The renumbering of stage 4's steps is internal to the briefing. No file in this repo cited the Critic's step numbers, so no cross-reference had to move with it.

To reproduce the validation above, take a historical behaviour-changing merge commit, extract its tree, take `git diff --name-only <commit>^ <commit>` as the excluded path list, derive terms from the diff under the rules in the canonical section, and run the command there.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). A changed stage briefing: the Critic gains a mandatory step and a line it writes on every run. No AGENTS.md field becomes required, no existing field is reinterpreted, no default is flipped, and no consumer repo has to change anything to keep working. Not `patch` — in this plugin the Markdown is the runtime, and this adds a step that did not previously exist. Not `major` — no caller breaks, and under 0.x there is no `major` bump in any case.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this is a behaviour change to a skill, the same self-application ADRs 0009 and 0010 record.
