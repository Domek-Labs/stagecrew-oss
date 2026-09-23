# ADR-0004: `merge_policy` — the Closer defers the merge by default

## Status

Accepted.

> **Canonical source note:** the live semantics of the `merge_policy` field — values, default
> resolution, the `defer` and `auto` behavior, claim handling, and the pre-flight STOP rule —
> are defined in `skills/work-issue/SKILL.md`, section "Merge policy (`merge_policy`)". This ADR
> records why the default was flipped; the SKILL.md section is the live source.

## Context

`/close-out` was a no-op in the default configuration. The chain of facts:

1. The `/work-issue` Stage 5 (Closer) merged on APPROVE: it squash-merged into `pr_base` with `--delete-branch`, closed the issue, and ran `deploy_command`. There was no state in which a Critic-approved PR sat and waited.
2. `/work-issue` has zero wave awareness — deliberately. It does not know a wave exists, let alone which one its issue belongs to.
3. `/close-out` defined a wave as ready when its PRs carried a Critic `APPROVE` comment and `/work-issue` was "waiting on the Closer". That waiting state did not exist.
4. `/close-out`'s partial-execution rule detects already-merged PRs via PR state `MERGED` and skips them silently.

Net effect: by the time `/close-out` ran, every PR was already merged — in loop-completion order, not wave order — and `/close-out` silently skipped all of them and reported success. Its single reason to exist (the ordered merge) never fired. The failure was invisible in practice precisely because it was silent: five parallel loops all merged themselves and the board looked fine.

A second symptom of the same coupling: with N parallel loops, N deploys ran — one per Closer — instead of one deploy after the wave was integrated.

## Decision

Introduce a `merge_policy` field in the `work-issue:` AGENTS.md namespace with two values, `defer` and `auto`, and make **`defer` the default**: the Closer produces a reviewable, CI-checked PR and stops there with the terminal verdict `ready-for-close-out`. `/close-out` owns the wave-ordered merge, the issue close, the label/branch cleanup, and the single post-merge deploy.

### A deliberate default flip, not an opt-in block

Unlike `components:`, `visual:` and `models:`, an **absent field is not behavior-preserving**: it resolves to the new default `defer`. An opt-in block would have preserved the broken default — every existing AGENTS.md would have kept merging in loop-completion order and `/close-out` would have stayed dead. The point of the change is that the *default* configuration produces the waiting state `/close-out` was designed around.

### What breaks for existing users

Any repo whose AGENTS.md lacks `merge_policy` changes behavior on upgrade: `/work-issue` no longer merges, closes the issue, or deploys at the end of a loop. The PR stays open with the `ready-for-close-out` verdict — the claim released, re-pickup blocked by the pre-flight open-PR check — until `/close-out` runs. A user who never runs `/close-out` ends up with open, approved PRs — visible and reversible, unlike the silent mis-ordered merges of the old default.

### Migration path

Set `merge_policy: auto` in the repo's AGENTS.md `work-issue:` namespace to restore the pre-flip **merge behavior** (squash-merge, issue close, per-loop deploy — Stage 5 steps 4–7 unchanged). This is also the recommended setting for single-issue use without waves. It is not a byte-for-byte restoration of everything: two changes apply under every policy — pre-flight runs the open-PR check (under `auto` it routes a re-run with an open PR to the Closer merge steps instead of re-working the issue, and STOPs if that PR carries no Critic `APPROVE` + Closer terminal comment naming it, or if more than one PR matches), and a CI-pending escalation releases the claim instead of holding it (see "Claim handling").

### Deploy ownership: relocated, not removed

`defer` as the default removes the only place that ever ran `deploy_command`, so `/close-out` gains a final deploy step: resolve `deploy_command` (AGENTS.md, else repo registry), run it **once per close-out run** after all requested waves are merged, health-check, and report in the final summary. Absent or empty command → clean skip with a note, never a STOP.

"After all requested waves are merged" means **every PR in the requested set actually merged, none skipped**. `/close-out` is re-entrant and skips PRs it cannot merge (non-additive conflict, red CI, missing APPROVE); if any PR in the set was skipped, the deploy is skipped too, with the reason named in the summary and the re-run named as the route to a deployed state. Deploying a half-integrated tree unattended, with no automatic revert, is worse than not deploying — and because a partial run deploys nothing, the eventual clean re-run still yields exactly one deploy for the set.

**The deploy stays autonomous.** It runs unattended inside the close-out run, with the same health check and the same no-automatic-revert constraint the Closer applies under `auto`. No step requires a human to trigger it — a deploy that needs a human would defeat the purpose of the loop. One deploy per close-out instead of one per loop is also the better behavior for wave runs.

### Claim handling

The claim is **released on every Closer terminal exit that leaves the PR open** — `ready-for-close-out` and `ESCALATE: CI pending` alike, under either policy. The Closer never holds a claim; a `merged` exit closes the issue, which retires the claim with it.

This rule was reached in two recorded reversals, not silently rewritten. The first version of this decision held the claim at `ready-for-close-out`, by analogy with `ESCALATE: CI pending`; review showed that is a deadlock: the stale-claim reclaim (TTL canonical in `skills/work-issue/SKILL.md`, "Claim protocol") requires no activity since the claim, and five stage comments always follow it, so a held claim never expires — and its only other release point, the `/close-out` label cleanup, only fires after a successful merge and may legitimately never run (never invoked, PR skipped on a conflict, branch abandoned). The happy path of the new default would have become a state only a human with `gh` could leave. The second version then kept the hold at `ESCALATE: CI pending` — and a second review found the same deadlock through that door: a CI-pending escalation never posts `ready-for-close-out`, so the `/close-out` release point never fires for it either. Once the open-PR check exists, the hold is redundant on *every* path that leaves a PR open — the PR is the guard — so the rule is uniform, with no exceptions.

The duplicate-work guard moves to a stronger signal: pre-flight stage 0 runs an **open-PR check** after `merge_policy` is resolved. Under `defer` it **STOPs when an open PR already exists for the issue**, pointing at `/close-out`; under `auto` it routes the run to the Closer merge steps for the existing PR, so the documented CI-pending recovery ("re-run `/work-issue <n>` once CI is green") finishes the merge instead of being refused. Either way the implementation stages never re-run.

The `auto` resume is **gated**: it proceeds only if the issue thread carries both a `## [stage:critic] APPROVE` and a Closer terminal comment (`ready-for-close-out` or `ESCALATE: CI pending`) **naming the PR about to be merged**, and that PR is the only match; otherwise it STOPs, naming every match and what is missing. The PR binding is what makes the gate mean anything: a thread-scoped check proves the *issue* was reviewed, not the *PR* being merged, so a second matching PR — a teammate's hand-opened `Fixes #<n>`, or any match on a reopened issue whose thread still carries an old loop's verdicts — would ride in on another PR's approval and reach the same unattended merge this gate exists to prevent. Without the gate, `auto` would have a path on which an unattended run squash-merges, closes the issue and deploys a PR that never passed review — the PR matcher is a heuristic (branch suffix or `Closes #<n>` in the body), so any hand-opened PR referencing the issue would qualify. The gate mirrors `/close-out` hard gate 2, keeps the loop's core promise — nothing ships unreviewed — true under both policies, and makes the heuristic fail toward a refusal rather than a merge. It costs nothing on the documented recovery path, which satisfies the two evidence conditions by construction; only the sole-match condition depends on the state of the repo at re-run time, and it fails into a STOP the user can clear by closing the stray PR. The PR is created by the same run, cannot be orphaned by a cleanup step that did not run, and disappears exactly when the work is genuinely done; the check also covers the window between the release and `/close-out`. `/close-out` treats an APPROVE'd PR left by a CI-pending escalation as ready once its checks settle, and still removes any `claimed:<agent-id>` label it finds, as a safety net for issues claimed by older runs.

### Version bump: `minor`, with a `version_policy` amendment in the same PR

Read literally, the pre-amendment `version_policy` classified a breaking default change as `major`, and under 0.x a major bump moves the leading zero — 0.x → 1.0.0. But `first_stable_bump` forbids 1.0.0 until the skeleton has been stable for 3+ months, every skill has a battle-tested end-to-end run, and the AGENTS.md schema has a compat guarantee — none of which held (`/close-out` had never run live). The two rules contradicted each other for exactly this change.

Resolution: ship as `minor` and amend `version_policy` in the same PR so the rule matches the practice — under 0.x a deliberate, documented default flip ships as `minor`, provided it is recorded in an ADR (this file) and the old behavior stays available as an explicit opt-in (`auto`). The leading zero is the compat signal; 1.0.0 remains gated on `first_stable_bump`.

## Alternatives considered

### Alternative A — opt-in `merge_policy` with `auto` as the default

Add the field but keep today's default, letting repos opt into `defer`.

- **Pros:** zero behavior change for existing AGENTS.md files, consistent with `components:` / `visual:` / `models:`.
- **Cons:** preserves the defect. The default configuration would keep merging in loop-completion order, `/close-out` would stay a silent no-op, and nobody would notice — the exact failure mode that motivated the change. An opt-in fix for a broken default is not a fix. Rejected.

### Alternative B — wave awareness inside `/work-issue`

Teach the Closer to read its issue's `wave:<n>` label and wait for earlier waves before merging.

- **Pros:** no new field; keeps merge and deploy in one place.
- **Cons:** couples the loop to the planning layer it was deliberately kept ignorant of; every loop would have to poll the state of other loops' PRs (a distributed wait with no coordinator); and issues without wave labels would need yet another branch. Knowing about waves is `/close-out`'s single job. Rejected — wrong owner.

### Alternative C — a merge-queue / controller process

A long-running controller that receives finished loops and merges them in order.

- **Pros:** the "real" solution for high-volume parallelism; also solves ready-queue scheduling.
- **Cons:** Phase 2 of the parallel design (#7). Requires a process supervisor, state beyond GitHub primitives, and a failure story of its own. `defer` + `/close-out` achieves the ordered merge with nothing but issue/PR state and labels. Deferred, not rejected — this ADR does not preclude it.

## Consequences

### Immediate

- `merge_policy` in the `work-issue:` namespace: `defer` (default, also the resolution of an absent field) | `auto`. Canonical semantics in `skills/work-issue/SKILL.md`, "Merge policy (`merge_policy`)".
- The Closer gains the `ready-for-close-out` terminal verdict; the "never terminates without a terminal verdict" invariant is preserved by enumeration.
- Pre-flight stage 0 caches the field; an unknown value is a STOP with a hint to `/init-agents --refine` — not a silent fallback, because a wrong value here changes whether code ships.
- Pre-flight stage 0 runs the open-PR check after `merge_policy` is resolved: under `defer` it STOPs when an open PR already exists for the issue, pointing at `/close-out`; under `auto` it routes the run to the Closer merge steps for the existing PR, but only when it is the sole match and the thread shows a Critic `APPROVE` plus a Closer terminal comment naming that PR — otherwise it STOPs, so no policy merges a PR the loop never reviewed (see "Claim handling").
- `/close-out` gains the final unattended deploy step and no longer claims it never deploys.
- `skills/init-agents/references/AGENTS.md.template` documents the field (the one deliberate copy artifact).
- This repo's AGENTS.md sets `merge_policy: defer` explicitly (dogfood) and carries the amended `version_policy`.
- `minor` version bump (see `.claude-plugin/plugin.json` for the current version).

### For issue #29 (worktree cleanup on terminal paths)

`defer` adds a new terminal path, and it cleans up its worktree: the branch is pushed to the remote, so the local worktree is disposable scratch and `/close-out` operates from the remote. The remote branch deliberately survives until `/close-out` merges with `--delete-branch`.

### Out of scope

- Wave awareness inside `/work-issue` — the loop stays wave-agnostic (Alternative B).
- A merge queue or controller process — Phase 2 of the parallel design (#7, Alternative C).
- Executable additive-conflict resolution and wave enumeration in `/close-out` — separate issues.
- GitHub Projects board status transitions — #32.
