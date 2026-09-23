# ADR 0020 — the loop wallclock and the Closer's CI poll become two budgets, both declarable in AGENTS.md

**Status:** accepted
**Date:** 2026-09-03
**Issue:** #118

> **Snapshot.** The numbers quoted under Decisions 3 and 4 are the defaults as decided on
> this date. Their canonical home is `skills/work-issue/SKILL.md`, "Hard caps"; if they move
> on, this record stays as written — it documents the decision and the evidence behind it,
> not the current text, and is therefore not a hard-gate-8 copy.

> **Superseded in part by `docs/adr/0024-claim-lifecycle.md`** (2026-09-16): the "TTL interaction"
> paragraph under decision 8 below argued that raising the wallclock cap could not expose a live
> run to premature reclaim, because "the stage comments guarantee that from stage 1 onward" and
> the stale-reclaim's no-activity condition could therefore never hold. That premise is gone —
> staleness no longer credits stage comments as activity — so the argument as written no longer
> holds, and the interaction now runs closer to the opposite direction it described: a genuinely
> stuck run's claim can again go stale on `claim_stale_minutes` alone. The section below is left
> as written: it is the record of what applied and what was reasoned at the time, not a live
> description.

## Context

`/work-issue` had **one** time budget: `Max wallclock 90 min`. Measured on `dev` @ `e79fd5f`
with `grep -rn "90 min\|90-min\|90min"`, the 90-minute relation was stated at **four** sites —
`skills/work-issue/SKILL.md:822` (the Closer's step 3), `:907` ("No silent Closer
termination"), `:914` ("Hard caps"), and `CLAUDE.md:149`.

Three defects, and they are not the same defect.

**1. The Closer's CI poll had no budget of its own — only a ceiling.** `:822` and `:907`
bounded the poll from *above* ("up to the 90-min wallclock cap") and gave it no number, no
start point and no lower bound. The firing rule was `:919`: a wallclock cap reached while the
Closer waits on CI exits as `ESCALATE: CI pending`. So the CI-pending escalation fired as a
function of **how long the implementation took**. A loop that reached the Closer in 70 minutes
gave CI twenty; one that reached it in 85 gave CI five. Neither number is a property of CI.

**2. Ninety minutes was set against an earlier model generation, and has been exceeded.** See
Decision 3 — this is a measurement, not a prediction.

**3. `:914` contradicted `:917` inside the same section.** `:914` said the overrun produces
"pause + message to the user"; `:917` said that on **any** hard-cap hit the run exits, releases the
claim and runs the terminal cleanup, and `:923` listed a hard-cap hit among the release exits.
Two of the three agreed with each other and with every downstream rule; "pause" agreed with
nothing and named a behaviour the loop has no state for.

## Decision

**1. Two budgets, not one.** The loop wallclock and the Closer's CI poll are separate caps.
The CI poll's budget is counted from the moment the Closer starts polling. Once the Closer
enters that poll the wallclock no longer ends the run, so a run may last up to
`wallclock_cap_min + ci_poll_cap_min` in total. That total is stated in "Hard caps" rather
than left to inference.

**2. Both are optional AGENTS.md fields — and the test that decides it is deletability.**

ADR 0019 removed a numeric word cap from the skills and said explicitly that its removal was
"**not** a licence to add a `word_cap:` field". A time cap looks like the same shape. It is
not, and the difference is not "how generation-sensitive is it":

> A constant a stage reads as **guidance** is deletable: remove the number and the instruction
> still works. That is what happened in #119 — the caps went, a required-field list stayed,
> and nothing had to decide anything.
>
> A constant the loop **branches on to reach a terminal verdict** cannot be deleted, because
> something must decide and "never terminate" is not an available behaviour. The number has to
> exist somewhere. In a plugin whose stated premise is pure-reader — no hardcoded defaults, all
> standards values from the target repo's AGENTS.md — a number that must exist and that only
> the target repo can get right belongs in that repo's AGENTS.md, with a documented fallback.

Applied: the word cap was deletable and was deleted. `wallclock_cap_min` selects between
"continue" and "release the claim, run the terminal cleanup, exit". `ci_poll_cap_min` selects
between "merge" and `ESCALATE: CI pending`. Neither is deletable, so both become fields.

A second, independent reason for `ci_poll_cap_min`: it is **not generation-sensitive at all**.
Its right value is how long *this repo's CI* takes — a property of the target repo in exactly
the way `syntax_check` and `smoke_test` are.

**This decision does not license reinstating a word cap, or any other guidance constant.**
It is not a reversal of ADR 0019; it is the second application of one rule. A future proposal
to add a numeric field must pass the deletability test first: delete the number, and if the
instruction still works, no field — say it in the repo's own prose instead. The test is
recorded here precisely so it does not have to be re-derived the next time.

Both fields are optional, both are outside the mandatory 11-field completeness check (the
posture of `models:` and `effort:`), and neither can STOP a loop: absent, non-numeric, zero or
negative all fall back to the default, are noted once in the pre-flight line, and the run
continues.

**3. The wallclock default becomes 240 min. Here is the derivation, and its honest status.**

The issue's `## Standards Notes` claimed "This repo has no recorded distribution of loop
durations". That is false, and the better argument comes from the record. Method: the delta
between a loop's `## [claim]` comment and its `## [stage:closer]` terminal comment, both
server-timestamped, on merged loops. Re-measured for this ADR from the issue threads:

| Issue | claim → Closer | Note |
|---|---|---|
| #99 | 19 min | |
| #106 | 30 min | |
| #119 | 35 min | the previous loop, current generation |
| #116 | **101 min** | single claim, continuous — **exceeded the 90-min cap**; a *combined* loop, claimed for #116 **and** #117 together |
| #111 | 658 min | single claim, no re-run; an outlier, almost certainly containing operator idle |

Plus `skills/work-issue/SKILL.md:16` — 33 min, 2 iterations, from the 2026-06 experiments under
an earlier generation.

**Caveat that travels with every one of these numbers:** claim-to-Closer wall time is an *upper
bound* on machine time. It contains any operator idle and any interruption. It is nonetheless
the same quantity the cap measures, which is what makes it the right evidence and not merely
the available evidence.

**#111 is an outlier and is excluded from the derivation** — not dropped quietly: at 658
minutes it is 6.5x the next-largest run and its Implementer stage alone spans nearly nine
hours, which no plausible reading attributes to compute. It is kept in the table because
excluding it silently would be the defect this ADR exists to avoid.

**#116 is the load-bearing measurement**, with its caveat stated: it is a real, single-claim,
uninterrupted run on this repo under the current generation that took 101 minutes, and it was a
combined loop covering two issues. The cap governs a *run*, not an issue, so a combined run is
exactly the case it has to survive — but "101 minutes for one issue" would be a misreading.

Derivation: the credible observed maximum is **101 min**. A cap must clear it by enough that an
unusual-but-progressing run is not killed, and none of the measured runs exercised the full
3-revise cap, which costs materially more than an unrevised loop. Doubling the observed maximum
gives 202; rounding up to a whole number of hours for legibility gives **240 min** — 2.4x the
observed maximum and roughly 7x the median of the credible set.

**Status of that number, plainly: 240 is chosen with stated headroom over measured runs. It is
not itself a measurement.** What *is* measured is that 90 was too small at least once. Anyone
reading "240" as an observed quantity is reading it wrong.

**And a finite cap does not eliminate the failure it is justified by, only its frequency.**
#111 would have been killed at 240 too, mid-Implementer, with the same discarded branch. This
issue's Out of Scope forbids changing what a cap hit *does*, so the value is the only lever
available, and the value cannot close the failure.

**4. `ci_poll_cap_min` defaults to 30 min — an independent number, never "the wallclock
remainder".** The issue's own Spec proposed "absent = the wallclock remainder (today's
behaviour)". That is rejected: no repo declares the field on the day it ships, so the default
would have preserved exactly the defect the issue exists to remove, and the split would have
been true only for repos that opted in. An absent field therefore resolves to its own number.

Evidence for 30: this repo's CI (`structural checks`) concluded in **9–21 seconds** across the
last 23 recorded runs (measured 2026-09-03 via `actions/runs`). Thirty minutes is ~85x that,
which is generous by design — the default has to cover a target repo whose CI builds
containers, not just this one — while still bounding the Closer's wait to a small fraction of
the loop budget. Like 240, it is **chosen, not derived from a distribution**; unlike 240 it is
the field most likely to be set per repo, because CI duration is the most repo-specific
quantity in this plugin.

The zero-change proof for this pair therefore covers the **fields** (absent = the documented
defaults, no repo has to change anything), not the defect: that the poll no longer draws on the
loop wallclock is a real behaviour change and is what makes this a minor bump.

**5. A cap hit names which cap — but the verdict marker never changes.** The terminal comment
and the `## [claim:released]` note carry `hard-cap: loop wallclock`, `hard-cap: ci poll`,
`hard-cap: 3 revises` or `hard-cap: 3x build fail`.

**Every exit that leaves a PR open still posts the literal `## [stage:closer] ESCALATE: CI
pending`, whichever cap fired.** The Pre-Flight open-PR resume gate matches that exact string
before it will merge a PR a previous run produced. A `hard-cap: loop wallclock` marker on that
path would fall through to the gate's "markers missing" branch, and the loop would STOP on a PR
it had produced and finished itself — the work becoming unmergeable by the loop. The
which-cap distinction is carried *inside* the comment and in the release note. Outside the
Closer no PR exists and there is no marker to preserve.

**6. The "pause" reading is not canonical.** `:914`'s "pause + message to the user" is replaced by
what the file's other three rules already said: the run exits, releases the claim and runs the
terminal cleanup. There is no pause state, no wait-for-a-human state, and nothing in the file —
not the channel-updates section, not the release path — ever implemented one. The old wording
is quoted at the replaced line so a reader who remembers it can see it was decided, not lost.

**7. The two resolved budgets print on one pre-flight line, on every run.** AC 5 asked for them
"next to the other resolved standards values" — a surface that did not exist: the pre-flight
had no general standards report. Rather than record the AC as unmeetable, a minimal surface is
defined (`skills/work-issue/SKILL.md`, "Resolved time budgets (pre-flight line)"): one line,
before stage 1, naming each budget and whether it came from AGENTS.md or the default, plus a
note for any value that was ignored as unusable.

It is deliberately **not** attached to the `strategy.gates` consistency report. That block's
print-nothing-when-clean rule is reasoned in the file — "a pre-flight that reports its own
silence trains the reader to skip it" — and a budgets line would violate it on every run. The
budgets line is not a report of problems that can be empty; it always carries two values.

**8. Four other time constants exist in the skills and are deliberately untouched**, recorded
here so a later "sweep the time constants" audit stops at them instead of removing them by
analogy (the manner of ADR 0019 decision 4):

| Site | Constant | Why it stays |
|---|---|---|
| `skills/work-issue/SKILL.md`, "Claim protocol" | stale-claim **TTL, default 60 min** | A liveness threshold for *another* run's claim, not a budget for this one. See the interaction below. |
| `skills/work-issue/references/subagent-briefs/visual-reviewer.md` | dev-server poll `timeout ~60s` | A readiness probe for a different artifact, not a loop budget. |
| `skills/work-issue/SKILL.md`, `skills/create-issue/SKILL.md`, `skills/init-agents/SKILL.md` (3 sites) | `>7 days` index freshness | A cache-staleness threshold, not a budget. |
| `skills/work-issue/SKILL.md:16` | `33 minutes` | A recorded measurement, not a constant the loop reads. |

**The TTL interaction, and it is the strongest argument against a large wallclock.** Raising the
cap does *not* expose a live run to premature reclaim — a competing claim counts as active if
the issue shows activity after it, and the stage comments guarantee that from stage 1 onward.
The interaction runs the other way: because the stale-reclaim's no-activity condition can never
hold after five stage comments, **the wallclock cap is the only bound on how long a live-but-
stuck run holds an issue exclusively.** Raising 90 → 240 lengthens that worst-case exclusive
hold by 2.7x, and the 60-minute TTL cannot shorten it. This cost is accepted here, with the
reversal condition named below, and it is the reason a much larger default was not chosen.

**Where the wallclock fires decides the verdict, not merely which cap is named.** Before the squash-merge a PR is open and nothing has landed, so a wallclock hit exits `ESCALATE: CI pending` naming that PR — the Pre-Flight open-PR check can route the re-run. From the squash-merge onward there is no open PR and no pending check: the merge stands and the issue is closed, so the exit is `merged` with the step that did not complete named alongside `hard-cap: loop wallclock`. Borrowing the CI-pending verdict there would describe a state that cannot exist and would promise a resume the open-PR check can never match. The first draft of this change did borrow it for all three of the steps it named — the merge, the drift check and the deploy — and a second draft then said the claim is never released after the merge, which strands a claimed open issue where `pr_base` is not the default branch and the step-5 explicit close has not run yet. The Critic caught both.

## Consequences

- Existing AGENTS.md files need no edit: absent fields resolve to the defaults. The old
  wallclock behaviour is available as an explicit opt-in — `wallclock_cap_min: 90` — which is
  the migration path `version_policy.minor` requires for a documented default flip under 0.x.
  With this ADR, the bump is a legal **minor**.
- The `AGENTS.md.template` carries both keys commented out **with no default value in them**.
  They are therefore pointers, not copies: nothing in the template has to change when a default
  changes. The list of five permitted copy artifacts in the root `AGENTS.md` stays at five.
- `ci_poll_cap_min` is **inert wherever the wait mechanism itself does not work.** Issue
  [#16](https://github.com/Domek-Labs/stagecrew/issues/16) reports three runs in which the
  bounded poll did not happen at all: a foreground `sleep` is blocked by the runtime, and the
  available alternative — a background task — cannot resume the stage that spawned it. On such
  a harness this field budgets a wait that does not occur. #16 is open and carries
  a `waiting-on:` label; nothing here changes its mechanism, its trigger condition or its marker
  string. **The existence of `ci_poll_cap_min` is not evidence that the wait works.**
- A wallclock hit inside the Closer but outside the poll still leaves a PR open and still exits
  `ESCALATE: CI pending`, so the resume path is unchanged for every reader and every tool.

## Alternatives considered

- **Keep one budget and raise it.** Rejected: it leaves the CI window a function of
  implementation duration, which is defect 1 and the sharper half of the issue.
- **Delete the numbers, add no fields** (the ADR 0019 move). Rejected on the deletability test:
  the loop branches on both constants to choose a terminal verdict, so something must decide.
- **`ci_poll_cap_min` absent = the wallclock remainder**, as the issue proposed. Rejected — it
  ships the defect as the default. See Decision 4.
- **A `hard-cap` terminal marker on every cap hit.** Rejected: it breaks the Pre-Flight resume
  gate on exactly the path where finished work is at stake. See Decision 5.
- **Per-stage time budgets.** Out of scope by the issue, and rightly: nothing in this loop can
  predict how long a stage will take, and a wrong per-stage number kills progressing work more
  often than one loop-level number does.

## What would reverse this

- A run killed at 240 minutes while still visibly progressing → raise the default, and record
  the new derivation the same way.
- A measured distribution showing loops reliably finish well under 60 minutes → lower it; the
  exclusive-hold cost above argues for the smallest cap the evidence supports.
- Any mechanism that lets the stale-claim reclaim distinguish a live run from a wedged one
  (a heartbeat, or a claim the loop refreshes) → the exclusive-hold argument weakens, and the
  wallclock stops being the only bound on how long an issue can be held.
- CI durations in real target repos clustering above 30 minutes → raise `ci_poll_cap_min`'s
  default, or document that it is a field repos are expected to set rather than inherit.
- #16's wait mechanism turning out to be unimplementable on every harness → `ci_poll_cap_min`
  becomes a budget for nothing and should be removed with the mechanism, not kept for symmetry.
