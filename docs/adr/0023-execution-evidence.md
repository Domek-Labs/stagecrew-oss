# ADR 0023 — the Tester produces a base-vs-branch execution comparison, and the Closer's merge gate reads it

**Status:** accepted
**Date:** 2026-09-15
**Issue:** #65
**Amends:** `skills/work-issue/SKILL.md` — new "Execution evidence" section next to "Scope-aware
`smoke_test`", the Tester briefing schemas (both loop types), the Tester skip rules (the
docs-only bypass now points into it explicitly), the Closer's step 3a and its "No silent Closer
termination" bullet, and the Pre-Flight open-PR check's resume gate (gains an `evidence-gate:`
tag branch). Adds `test_globs` to the AGENTS.md schema. `CLAUDE.md` (Tester and Closer sections,
rule count four→five). Supersedes nothing.

> **Numbering note.** The issue's Files-to-Touch named `docs/adr/0006-execution-evidence.md`,
> which collides with the already-shipped `docs/adr/0006-label-axes.md`. `docs/adr/` runs
> 0001–0022 — though 0022 itself is shared by two records
> (`0022-squash-merge-identity-mismatch.md` and `0022-validator-execution-path-gate.md`), which
> this note's original "no gap" framing undercounted — so **0023** is still the next free
> number: a plain sequential renumbering with no other semantic content, resolved unambiguously
> rather than treated as a spec defect.

> **Snapshot.** Decision 4's and the Version section's restatements of the gate's blocking
> conditions, and the "Missing has two causes" split added during revise, are the rule as decided
> on this date. Their canonical home is `skills/work-issue/SKILL.md`, "Execution evidence" §5; if
> that text moves on, this record stays as written — it documents the decision and the reasoning
> behind it, not the current text, and is therefore not a hard-gate-8 copy.

## Context

A loop can reach `PASS` → `APPROVE` → `merged` without anything having been verified. Three
cases motivated this issue: a test written inside a completed loop that was never executed in
CI at all (the browser it needs is provisioned only *after* the test job runs); a guard that
swallowed every exception, so under load it asserted nothing while still reporting success; and
a page check that could not observe short blocks, so clipped rows passed silently. Nothing the
loop produced before this change distinguished any of these from a real pass.

Two mechanisms already existed and both stopped short of the level that would have caught these:

1. **The Tester's evidence was an assertion, not an artifact.** The brief asked for "per AC
   checkbox: smoke test + proof (log snippet, command output)". A stage comment quoting output
   has no reference run to compare against, so "0 tests collected" and "412 tests collected,
   all green" produced the same verdict.
2. **The Closer's CI base-vs-PR baseline (ADR 0016, #15) reads check *conclusions*, not
   execution.** A check that collects zero tests concludes `success`, so at that granularity it
   *is* a pass by definition. The baseline machinery — the four-state resolution, the collapse
   of same-named runs, the fail-safe `unknown` state — is correct and untouched by this change;
   the level it reads at was too coarse to see the three cases above.

The skip surface compounds this: scope-aware `smoke_test` (#54) added two legitimate
non-blocking skips (`scope_not_applicable`, `parallel_unsafe`), the docs-only rule adds a
third, and the code-graph pre-flight degrades silently in three enumerated states. Each is
correct in isolation and each is recorded only as prose in one stage comment; none is ever
compared against a reference. Summed, legitimate skips can reach "nothing was verified" without
any single step reporting a problem.

## Decision

**1. Execution over conclusions.** Rather than deepen the Closer's check-conclusion read (there
is no deeper level available through `actions/runs` — a check's *conclusion* is the finest grain
GitHub Actions exposes), the Tester now produces a second artifact one level down: the actual
`collected` / `passed` / `failed` counts and the skip *set* from a real run of the resolved
`smoke_test` command, on both the branch and a reference commit. A check conclusion answers "did
the runner exit non-zero"; this answers "did the runner exercise anything, and is that changing".
The two are complementary, not competing — the CI baseline still catches an infra-level failure
this comparison cannot see (a build that never starts), and this comparison catches a
runner-level no-op the baseline is blind to (`0 collected`, still `success`).

**2. A base run, not an absolute threshold.** An absolute floor ("at least N tests must run")
cannot be chosen correctly from inside this plugin: it is pure-reader by design (`AGENTS.md` is
the sole source of standards values), and the right floor for one target repo's test suite says
nothing about another's. A **comparison against the same repo's own `pr_base`**, run with the
same resolved command, needs no calibration and degrades the same way in every repo: a
regression shows up as fewer collected tests, a new skip, or a dropped baseline — never as a
number that has to be guessed once and then maintained. This is the same argument ADR 0016 made
for the CI baseline itself (compare against the base, not against a fixed target) applied one
level deeper.

**3. Most ambiguous states are recorded, not force-failed — this is the "why does anything short
of a hard FAIL exist" question the issue's Files-to-Touch flagged.** Three classes of ambiguity
are real and none of them is evidence of a bad diff:

- **`collected: unknown`** — not every test runner emits a collectable count in a form this
  plugin can parse without a runner-specific integration (out of scope, per the issue: "no
  migration of ... parsing every runner's output format"). Forcing every unparseable runner
  output to `FAIL` would make the gate unusable for a real slice of repos rather than making it
  stricter — the same trade-off `docs_command` made when a *mandatory* field broke every
  existing repo's pre-flight within the hour (`skills/init-agents/SKILL.md`, "Optional field:
  `docs_command`"). `collected: unknown` is recorded and the count-based rows that need a
  number are simply not evaluable — a narrower, honest degrade instead of a wrong verdict.
- **`base: unavailable`** — the base run is a throwaway worktree built from `pr_base` at loop
  time; it can fail for reasons that have nothing to do with the diff under review (a flaky
  dependency install, a transient network failure cutting the worktree add). Recording the
  state rather than failing the Tester keeps a repo-infrastructure hiccup from being read as a
  defect in someone's diff — but the ambiguity does not travel all the way to the merge: §5's
  gate still blocks on `base: unavailable` when the repo declares a real `smoke_test`, because a
  merge is a stronger claim than a Tester comment and deserves the stricter reading.
- **`revert_check: unavailable` / `n/a`** — `test_globs` is optional and a large share of
  existing repos will not have declared it on day one; failing every Tester run in such a repo
  over a field nobody has been asked for yet would repeat the `docs_command` mistake at gate
  scale. The one case this plugin still refuses to let through silently is a `bug`-labelled
  issue reporting `n/a — diff adds no tests`: not a Tester `FAIL` (a one-line guard fix can
  legitimately need no new test), but a **named Critic finding**, because a bug fix that adds no
  regression coverage is exactly the kind of thing a human reviewer should see flagged rather
  than have quietly pass.

**4. The Closer's merge gate is a hard block, not a second warn tier — except for a bypass the
gate must not misread as a failure.** Where §3 above chooses to record rather than fail at Tester
time, the Closer's gate (§5 of "Execution evidence") does not carry the same leniency forward for
a genuinely missing evidence block, `verdict: fail`, or `base: unavailable` against a real
`smoke_test` — all three block the merge outright. The asymmetry is deliberate — a Tester
comment is one stage's report and can stay provisional across a revise cycle; a merge is
irreversible via `Closes #N` and an unattended deploy, so the last gate before it reads the same
signals more strictly than the stage that produced them. **"Genuinely missing" excludes the
pre-existing docs-only skip**, which bypasses the whole Tester stage — this procedure included —
before it ever runs: this repo is Markdown-only, so that bypass fires on most of its own diffs,
and reading its absence as "missing" would have made the gate permanently unsatisfiable for the
repo the issue was written against. The Critic caught this in revise round 1: an earlier draft of
this section left the docs-only bypass out of §5's blocking check entirely.

**5. No new terminal verdict.** A Tester `FAIL` from this procedure is a Tester `FAIL` like any
other — it reaches the Critic under the existing 3-revise cap. The Closer's merge-gate block
reuses the existing `ESCALATE: CI pending` marker (see "Closer merge behavior" and ADR 0020
decision 5) rather than inventing a new one, for the same reason ADR 0020 gave: the Pre-Flight
open-PR resume gate matches that literal string, and a differently-named verdict on a path that
leaves a PR open would make the loop's own finished work unmergeable by a later run.

**6. The evidence-gate escalation must be clearable, so the resume gate branches on a named
cause instead of guessing.** Reusing the `ESCALATE: CI pending` marker (decision 5) is necessary
but not sufficient: the Pre-Flight open-PR resume gate, before this round, routed every resume
straight to the Closer's merge steps and never back to the Tester — correct for a pure CI-pending
wait, but a deadlock for an evidence-gate block, since the same missing/failed evidence would
still be missing/failed on the next Closer pass. The fix adds one literal tag to the Closer's
blocking comment — `evidence-gate: <missing | fail | base-unavailable>` — that the resume gate
reads to choose between the unchanged CI-only path and a new **evidence-gate re-entry**: a fresh
Tester pass on a worktree rebuilt from the existing remote branch, whose result either clears the
gate (straight on to the Closer merge steps, no new Critic pass, no second PR — the diff has not
changed and already carries a live APPROVE) or reaches the Critic as an ordinary Tester `FAIL`
under the same 3-revise cap. Both branches stay inside the issue's Out of Scope: no new terminal
verdict (still `merged` or `ESCALATE: CI pending`) and no change to the cap's size or count. The
Critic flagged this in revise round 1 as the harder of the two blocking items; full mechanics are
in `skills/work-issue/SKILL.md`, "Pre-Flight stage 0" (the resume-gate branch) and "No silent
Closer termination".

## Consequences

**What is gained.** The three motivating cases — a test that never ran in CI, a guard that
swallowed every exception, a check blind to short content — all surface as a `0 collected`,
a dropped-test, or an added-skip finding, or fail the revert check outright, before the Closer
ever reaches the merge step.

**What is not gained.** This is not mutation testing and sets no coverage threshold — the
comparison is always base-vs-branch, never an absolute quality number (explicitly Out of Scope).
It cannot catch a test that was always this weak, only a *regression* relative to `pr_base`; a
repo whose base already collects zero useful tests stays undetected until a run pushes it
further backward. Retrofitting evidence onto already-merged PRs is out of scope, so this record
starts counting from the first loop that runs under it.

**Cost.** Two additional throwaway worktrees per Tester run (§2's base run, §3's revert check)
where `smoke_test` resolves to a real command — each following the same detached,
every-exit-path teardown discipline the loop's primary worktree already uses ("Git worktree
isolation" → "Cleanup — worktree, then local branch"), so a failed removal is reported and never
fatal, exactly as it is for the primary worktree. A third worktree, non-detached this time, is
paid only on the evidence-gate re-entry path (decision 6) — a resume that would otherwise deadlock.

## What would reverse this

- The false-block rate (docs-only diffs excepted, per decision 4) turning out to exceed the
  regressions the gate actually catches → the Closer's hard-block posture (decision 4) would
  move to a warn tier instead, or the blocking states would narrow further than "genuinely
  missing" already narrows them.
- A reliable, cross-runner count parser removing the need for `collected: unknown` as a class →
  that degrade could tighten from "recorded, not evaluable" to an actual number, without changing
  the gate's shape.
- **#68's spec-time Validator gate** (a Test Plan naming its execution path) proving sufficient
  on its own in practice → this run-time gate could be relaxed to a warning; that call belongs to
  whoever observes the two mechanisms running together over real loops, not to this record.
- The evidence-gate re-entry (decision 6) turning out to need its own Critic pass after all (e.g.
  a repo where a regenerated evidence artifact alone is judged insufficient grounds to skip
  re-review) → the "PASS skips stage 4" branch would need to become "PASS still reaches the
  Critic", which is a cap-relevant change and would need its own amending record.

## Version

A new AGENTS.md field (`test_globs`) plus a new Closer merge gate is documented runtime
behaviour the loop's execution depends on, which `version_policy` classes as **minor**: a
backwards-compatible new field with a safe default (absent → `revert_check: unavailable`, never
a STOP) and a new gate that a repo cannot opt out of but that only blocks on a state
(`verdict: fail` / a genuinely missing block, i.e. not the docs-only bypass / `base: unavailable`
against a real `smoke_test`) no existing merged loop could have produced retroactively — and,
once opened by that state, is designed to clear on a re-run rather than deadlock (decision 6).
The number itself lives only in `.claude-plugin/plugin.json`, per the single-source rule.
