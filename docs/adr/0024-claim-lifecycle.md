# ADR 0024 — a claim's liveness is judged by its own id, not by stage comments; the Closer retires it on every terminal path, including success

**Status:** accepted
**Date:** 2026-09-16
**Issue:** #138
**Amends:** `skills/work-issue/SKILL.md` — the "Claim protocol" section (the `Activity` / `Active vs. stale` / `Retired claim` definitions, the staleness-filter step, a new "Heartbeat (optional)" note, the "Evaluation order" closing sentence), "Closer merge behavior" (the `Uniform claim rule` paragraph and a new "Claim retirement on success" paragraph), the Stage 2 worktree-creation paragraph (a new "Branch reuse on takeover" note), Stage 5 step 5, "Issue close when pr_base ≠ default branch", Stage 5 step 9's cleanup sentence, the two "Hard caps" / "Release on failure" passages that argued a held claim has no reachable release point, and the "Hard caps" paragraph on a wallclock hit landing after a merge with a non-default-vs-default `pr_base` (it asserted retirement happens by itself; retirement is now step 5's explicit sequence, so that paragraph now also states what the terminal comment must name when the cap fires before that sequence completes). `CLAUDE.md` — the "Parallel-safe `/work-issue`" section, at pointer level. **Supersedes in part** (by note, not by rewrite) a specific paragraph of `docs/adr/0020-split-time-budgets.md` §8 ("The TTL interaction") whose premise this change removes; the rest of that ADR, including the decision to keep the stale-claim threshold a hardcoded constant, is unaffected and is not touched here.

## Context

A claim can outlive its run in both directions, and both were measured in this repo before this change:

1. **A dead run's claim never expires.** The staleness rule read *any* event on the issue after a competing claim's comment — including that same run's own later `[stage:*]` progress comments — as proof the claim was still active, regardless of the run's actual state. A container that died mid-loop (session limit, crash) left its last stage comment as permanent, silent proof of life: #113 in this repo hit exactly this on 2026-09-16 (Validator GO at 23:53, then nothing), and the pattern had already been observed on two other repos on 2026-09-11. The issue was unstartable until a human removed the label by hand.
2. **A successful run's claim never retires.** The Closer's `merged` path closed the issue and stopped there. The label survived on the closed issue, and the *repo* label — created fresh per agent-id — was never deleted, so every green loop minted one permanent label nobody would ever remove. Measured on 2026-09-16: ten closed issues still carrying `claimed:stagecrew-820ef571`, three more single-use labels each on one closed issue, and six further orphaned labels pointing at no issue at all, deleted by hand.

Both symptoms trace to one sentence: **the claim protocol defined how a claim is taken, not how it ends.** Staleness could not tell "still working" from "already dead" because it read a *symptom of having once claimed* (a stage comment) as a *proof of being alive right now*, and nothing anywhere retired a claim once the work it protected was actually finished.

## Decision

### 1. Activity is scoped to the claim's own id, not to "anything happened on the issue"

`Activity`, the signal that keeps a competing claim looking active past its own comment's age, now counts **only** a later comment carrying that *same* claim's `<agent-id>` — a duplicate `## [claim]` comment from a retry, an optional `## [claim:heartbeat]`, or that id's own `## [claim:taken-over]` / `## [claim:released]` note. A `[stage:*]` progress comment no longer counts, whoever posted it, including the claiming run itself: it records what a stage did, not that the run posting it is still alive. Label and assignment events are not activity for this test either — they already have narrower, separate roles (`unlabeled` for retirement, `assigned`/`unassigned` for the out-of-band residue test) and folding them into "activity" too was never load-bearing for anything this change touches.

The practical effect: a claim whose last own comment is older than `claim_stale_minutes` (this ADR's name for the existing 60-minute default; see decision 5) is stale even when other comments — stage comments included — followed it. A takeover of a stale claim is announced with `## [claim:taken-over] <old-id>, stale for <N> min` (replacing the previous `## [claim:reclaimed]` wording with the literal marker the issue specified) and, when the dead run had already pushed a branch for the issue, the takeover reuses it (`git ls-remote --heads <git_remote> <branch>` before cutting a fresh one) instead of producing a second branch — see "Branch reuse on takeover" in `skills/work-issue/SKILL.md`.

### 2. Heartbeats are named as optional infrastructure, not implemented as a mandate

The issue offered a heartbeat comment (`## [claim:heartbeat]`) as one way a long-running loop could stay demonstrably alive without relying on stage comments. This ADR names the format and defines how it would be read (as an id-carrying comment, same as any other), but does **not** wire it into the five stage briefs — those files are outside this issue's files-to-touch, and adding a per-stage obligation to every brief is a separate, larger change than a spec section can absorb honestly in one pass.

**The accepted, named cost of deferring it:** a loop whose own run genuinely takes longer than `claim_stale_minutes` end-to-end is, until a heartbeat is actually wired in, reclaimable mid-run by a second `/work-issue` invocation on the *same* issue. This is a real gap, not a rounding error — the default wallclock cap (`wallclock_cap_min`, 240 min) is four times the default `claim_stale_minutes` (60 min), so a slow-but-alive run is not structurally protected against a concurrent claim attempt on the same issue for the whole time it might legitimately run. It is accepted here because it is strictly narrower than the bug being fixed: it requires a *second* run to target the *same* issue while the first is still working, which is rarer than a dead run's own leftover comment defeating staleness forever; a repo whose stages routinely run long can raise `claim_stale_minutes` today, and wiring the heartbeat into the stage briefs — including naming the cadence a posting stage must keep, which the follow-up still owes — is recorded as a named follow-up, not silently dropped.

### 3. The Closer retires the claim on the `merged` path, symmetrically with the release it already does elsewhere

The Closer's `merged` verdict already had no reachable failure branch to hang a release off — the merge succeeded, the issue closed. The gap was that nothing then removed the claim label from the now-closed issue or reclaimed the repo-wide label once nothing needed it. The fix adds one deterministic sequence, run right after the issue closes (both the auto-close and the explicit-close-for-divergent-`pr_base` branches, uniformly):

1. Remove the issue's own `claimed:<agent-id>` label.
2. Check whether **any other issue, open or closed** (`--state all`) still carries that exact label.
3. If none does, delete the repo label itself; if at least one does, leave it untouched.

Order matters: step 1 runs before step 2 counts, so the closing issue never counts as its own reason to keep the label. This is named **retirement**, deliberately not **release** — there is no assignee removal and no `## [claim:released]` note, because there is no pool for the issue to return to and step 10's terminal comment already carries the outcome. The `--state all` reach mirrors the same choice already made for the `goal:`/`waiting-on:` label contract (`skills/plan-issues/SKILL.md`) — a label's history is not something a check silently forgets once one carrier closes.

### 4. The "held claim has no reachable release point" argument is retired along with the bug it depended on

Two places in `skills/work-issue/SKILL.md` (the Closer's uniform claim rule, and the "Release on failure" / "Hard caps" passages for `ESCALATE: CI pending`) justified *always* releasing the claim on an exit that leaves a PR open by arguing a held claim would otherwise deadlock: the stale-reclaim's no-activity condition, they said, could never hold, because five stage comments always follow a claim. Decision 1 removes exactly the premise that argument depended on — stage comments no longer manufacture activity — so restating it unchanged would leave a now-false claim standing in the very file whose rule this ADR fixes.

The conclusion does not need that premise, and this ADR does not invent a replacement mechanism to save it: the Closer already had a **better** reason on the same paragraph, stated but previously treated as secondary — the open PR itself, via the Pre-Flight open-PR check, is what actually prevents duplicate pickup on every path that leaves a PR open. Holding the claim label in that state adds no protection the PR does not already provide, so releasing it costs nothing. Both passages now argue from that ground alone; the retired argument is named, not deleted outright, so a reader who remembers the old wording can see why it changed.

### 5. `claim_stale_minutes` is a name, not a new field

The issue's spec and test plan use `claim_stale_minutes` throughout, but no such AGENTS.md field exists — the threshold has always been a hardcoded default (`docs/adr/0020-split-time-budgets.md` §8 lists it explicitly among "four other time constants... deliberately untouched", i.e. a liveness threshold for *another* run's claim, not a per-repo budget). This ADR adopts `claim_stale_minutes` as the documented name for that same constant, unchanged at 60 minutes, and does **not** promote it to a configurable field — that would reopen a decision ADR 0020 already made deliberately, for a reason this issue does not revisit (the interaction it names — a longer wallclock cap not being bounded by a TTL that stage comments always defeated — is itself partly what this ADR fixes; see "What would reverse this").

## Consequences

- **No new AGENTS.md field, no schema change.** `claim_stale_minutes` is a naming clarification of an existing hardcoded constant; `commit_identity`, `models:`/`effort:`, and every other opt-in block are untouched.
- **Existing `claimed:*` labels on already-closed issues are not retroactively cleaned up** — out of scope, named as such in the issue (a one-off chore already performed by hand on 2026-09-16 for the six orphaned labels this measurement found).
- **A loop that legitimately runs past `claim_stale_minutes` is, until the heartbeat follow-up lands, exposed to a takeover by a concurrent claim attempt on the same issue** — decision 2's named, accepted cost.
- **No opt-in is offered for the old behavior**, and none is possible in the sense `version_policy`'s minor rule asks for: the old behavior is the bug (a claim that a dead run can hold forever, and a label a live repo can never lose), not a preference a repo might reasonably keep. Per the same allowance ADR 0007 used for a removed skill, that impossibility is recorded here rather than an opt-in being invented to satisfy the letter of the rule.

## Alternatives considered

- **A watchdog or external reaper process.** Rejected by the issue itself (explicitly out of scope): it adds a moving part outside the loop, and the staleness rule already gives the *next* run everything it needs to reclaim a dead one — no external process is needed once staleness actually works.
- **Excluding only the *last* stage comment from activity, keeping earlier ones.** Considered and rejected: arbitrary (why the last one and not the last two), and still defeated by a run that happens to die right after any stage comment, which is the exact failure this ADR closes.
- **Making `claim_stale_minutes` a configurable AGENTS.md field now.** Rejected for this change: it would reopen ADR 0020's deliberate decision to keep it a hardcoded constant, which that ADR reasoned about on its own terms (see "What would reverse this" below for the one condition that would justify reopening it).
- **Mandating the heartbeat comment in all five stage briefs immediately.** Rejected for this change: those briefs are outside this issue's files-to-touch, and this repo is Markdown-only with no code to gate the change behind — wiring a new per-stage obligation into five separate briefs in the same pass as a protocol-semantics change is a larger, separable unit of work, named as a follow-up instead.

## What would reverse this

- A measured pattern of legitimate long-running loops losing their claim mid-run to a concurrent attempt on the same issue (decision 2's accepted cost turning out to bite in practice, not just in principle) → wire the heartbeat into the five stage briefs, or raise the default `claim_stale_minutes`, or both; either reopens decision 5's "not a field" choice if a per-repo override turns out to be needed.
- A repo whose stages routinely and legitimately run past 60 minutes end-to-end, before any heartbeat exists → the case for promoting `claim_stale_minutes` to a real AGENTS.md field (declined in decision 5) gets stronger with every such repo.

## Version

**Minor**, per `version_policy`. This is a deliberate, documented default flip on an existing behavior (staleness no longer credits stage comments; the Closer now retires a claim on success) — the minor rule's two conditions are: (a) an ADR records the flip, satisfied by this file, and (b) either the old behavior stays available as an opt-in, or, where that is impossible, the ADR records why. The old behavior here is the bug this issue reports, not a preference, so (b) is met the same way ADR 0007 met it for a removed skill: the impossibility is recorded above, under "Consequences". The number itself lives only in `.claude-plugin/plugin.json`, per the single-source rule.
