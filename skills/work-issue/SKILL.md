---
name: work-issue
description: "Drive a GitHub issue through a 5-stage spec→build loop (Validator → Implementer → Tester → Critic → Closer). Multi-repo. Pure-reader — all standards values come from AGENTS.md at the repo root (no skill defaults). Reads the loop-type:<type> label and dispatches to a type-specific subagent brief (code|research). Mandatory pre-flight checks AGENTS.md existence, YAML parseability and completeness, and reports (never STOPs) a strategy.gates gate whose mechanism is unconfigured. Codebase-memory mandatory pre-flight. Auto-PR on APPROVE, then the Closer merges in-loop (squash-merge, issue close, remote-branch delete, deploy). Triggers: /work-issue, work issue, loop workflow, drive issue, spec build loop."
---

# /work-issue — Spec→build loop for GitHub issues

**Type:** loop workflow / autonomous issue implementation

## Purpose

Drive a fully-specified GitHub issue (Idea + Spec + AC + Files-To-Touch + Test-Plan + OoS) through 5 dedicated subagents to a Critic-approved, CI-checked PR that the Closer then merges in-loop — squash-merge, issue close, remote-branch delete, and deploy (see "Closer merge behavior"). Each stage = one agent that posts a `[stage:<name>]` comment on the issue as an audit log, then the next stage starts.

This skill is a **pure-reader**: no hardcoded defaults. All standards values (branch_pattern, syntax_check, smoke_test, ...) come from **AGENTS.md at the repo root**. Missing AGENTS.md → STOP with a pointer to `/init-agents`.

## Invocation variants

```
/work-issue 5 --repo your-org/your-repo
/work-issue your-org/your-repo#5
/work-issue 5                                # → fallback: cwd git repo
/work-issue                                  # → lists open issues, asks for selection
```

**Argument parsing:**
1. `<owner>/<repo>#<num>` matched → split into `repo` + `issue_num`
2. `--repo <slug>` flag + bare number
3. `git -C $(pwd) remote get-url origin` → cwd fallback
4. No number → `gh issue list --repo <slug> --state open --limit 30`, user picks
5. Issue number cannot be resolved → ask whether `/create-issue` should be called

## Standards source (2-tier)

| Tier | Source | What it overrides |
|------|--------|-------------------|
| L1   | `AGENTS.md` at the repo root (YAML frontmatter) | base values — repo-specific conventions |
| L2   | `## Standards Override` block in the issue body | L1 — issue-specific one-shot |

Load L1 → L2, merge right-wins. **L1 is mandatory** (see the pre-flight check below). Skill-default L1 does not exist — `/init-agents` creates AGENTS.md.

**Model and effort resolution sits inside L1.** The `work-issue.models.<stage>` and `work-issue.effort.<stage>` keys are L1 base values; `loop_types.type_overrides.<loop_type>.models.<stage>` and `loop_types.type_overrides.<loop_type>.effort.<stage>` are a second L1 layer that right-wins over the base (it is part of AGENTS.md, not a separate tier). A `models.<stage>` or `effort.<stage>` key nested under `work-issue:` in the issue's `## Standards Override` block acts as the L2 override for that stage. Nothing set at any layer → inherit the session model and run at the API/session default effort. The two axes resolve identically; neither is a separate mechanism. See "Model and effort resolution (per stage)" under "Pre-Flight stage 0" for the full precedence rule and the literal override YAML.

**Producer side** (`/create-issue`): auto-injects AGENTS.md `ac_templates` into the AC block and detects issue types (docs/epic/secret/mcp/live-ping/live-service) with required extensions. The Validator stays strict — the producer is opinionated. See `skills/create-issue/SKILL.md`.

## AGENTS.md format (L1)

YAML frontmatter + Markdown body. The frontmatter is parsed by the skill; the body is loaded as context in the subagent briefing.

```yaml
---
work-issue:
  branch_pattern: "feature/<scope>-<issue>"
  default_branch: main | dev
  pr_base: main | dev
  commit_format: "conventional" | "custom"
  syntax_check: "<command>"           # e.g., "node --check <file>"
  docs_command: "<command>"           # regenerates derived docs; "" = not applicable
  smoke_test: "<command>"             # plain string (e.g., "docker compose build && smoke") OR a scope mapping (see below)
  deploy_command: "<command>"
  linter: "<command>"
  commit_identity:                    # optional — author identity for all loop commits
    name: "Your Name"
    email: "<id>+<user>@users.noreply.github.com"
  models:                             # optional — absent = inherit the session model for every stage
    validator:   <alias>              # aliases only: opus | sonnet | haiku | fable
    implementer: <alias>
    tester:      <alias>
    visual:      <alias>              # cached but unused when visual: block is absent
    critic:      <alias>
    closer:      <alias>
  effort:                             # optional — absent = the API/session default effort for every stage
    validator:   <level>              # levels only: low | medium | high | xhigh | max
    implementer: <level>
    tester:      <level>
    visual:      <level>              # cached but unused when visual: block is absent
    critic:      <level>
    closer:      <level>
  wallclock_cap_min: <minutes>        # optional — the loop's own time budget; default in "Hard caps"
  ci_poll_cap_min: <minutes>          # optional — the Closer's CI-poll budget; default in "Hard caps"
  hard_gates:
    - "rule description"
    - "no_unconfigured_coauthors"     # rule canonical in skills/github/SKILL.md §3
  default_oos:
    - "..."
  ac_templates:
    - "tests green"
    - "docs updated"
---

# Agent Instructions for <repo>
... narrative context (architecture, conventions, "why so") ...
```

Template: `../init-agents/references/AGENTS.md.template`. If a repo does not yet have an AGENTS.md, call `/init-agents --repo <slug>`.

### Scope-aware `smoke_test` (and parallel-safety)

`smoke_test` accepts **either** a plain string (the current behaviour, unchanged) **or** a scope mapping. The plain string is the zero-change form — a plain-string `smoke_test` behaves exactly as it always has (the Tester runs it verbatim for every non-docs diff).

The scope-mapping form lets a repo run different smoke commands depending on which part of the codebase the diff touches, and declare whether the smoke test is safe to run while another loop is active on the same repo:

```yaml
smoke_test:
  backend: "<command>"        # run when the diff falls in the backend scope
  frontend: "<command>"       # run when the diff falls in the frontend scope
  default: ""                 # run when the diff matches no named scope (empty string = skip)
  parallel_safe: true         # optional, default true; if false, the smoke test is SKIPPED when another active claim exists on the repo
```

**Scope resolution from the diff:** the scope is resolved from the diff paths.
- If the AGENTS.md `components:` block is set, the diff paths are matched against `components.code_globs` (the same globs that gate registry reuse) to decide `frontend` vs `backend`.
- If `components:` is absent, an explicit `scopes:` map inside the `smoke_test` mapping supplies the globs per scope key:
  ```yaml
  smoke_test:
    backend: "<command>"
    frontend: "<command>"
    default: ""
    scopes:
      backend:  ["api/**", "server/**", "**/*.py"]
      frontend: ["web/**", "app/**", "**/*.tsx"]
  ```
- The Tester runs **only** the command for the matched scope. Multiple scopes touched → run each matched scope's command. No scope matched (or the matched scope's command is the empty string) → the smoke test is not applicable to this diff scope; the Tester skips it and names the reason in its stage comment (see the Tester skip rules).

**`parallel_safe: false`** declares a smoke test that is unsafe to run concurrently (e.g. `docker compose up -d --force-recreate`, which tears down containers another loop may be using). When set to `false` AND the loop detects **another active claim on the repo** (reuse the claim-protocol detection from the Stage 0 pre-flight — any other `claimed:*` label / non-retired `## [claim]` comment with another agent-id; the assignee is advisory and never a claim signal, see "Claim protocol"), the Tester **skips** the smoke test and records the reason in its stage comment rather than executing it. Default is `true` (parallel-safe): no change for existing setups. This only honours a declaration — it does not attempt to auto-detect whether an arbitrary command is parallel-safe.

### Execution evidence

A loop can reach `PASS` → `APPROVE` → `merged` on a Tester comment that is an **assertion**, not an **artifact**: a stage comment quoting output has nothing to compare against, so "0 tests collected" and "412 tests collected, all green" read the same. This section is the **canonical, single definition** of the base-vs-branch execution comparison that fixes that, and of the revert check that proves a new test depends on the change it ships with. Every other mention — both Tester briefing schemas below, the Tester skip rules, the `code`-implementer brief's Tester criteria, the `research`-implementer brief, and the Closer's merge gate and terminal comment — points here and restates no value, per hard gate 8. Rationale, and why several states below are recorded rather than force-failed: `docs/adr/0023-execution-evidence.md`.

**Docs-only bypass (evaluated before §1).** The pre-existing Tester skip rule ("Tester skip rules" below, `code` loop — docs-only) skips the **whole** Tester stage — this procedure included — for a diff confined to `docs/**` / `**.md` / comment-only changes, recording `skip_tester_round_N: docs_only` in the state instead of running any part of §§1–5. This repo is Markdown-only, so a `.md`-only diff is its normal case, and most of its own loops (including the one that shipped this section) take this path. §5's merge gate reads a round recorded this way as a distinct, **non-blocking** absence — see the qualification in §5 — never as the "missing" block a Tester that *ran* failed to produce. `docs_only` is therefore never a state this procedure itself produces; see the note on §2's skip set below.

#### §1 — Applicability, decided once from `smoke_test`

Decided from `smoke_test` resolved **at both refs**, not the branch alone — the mechanism the downgrade rule below needs and did not have before this revision. Resolve the branch's value as already described (scope-matched against the branch diff, "Scope-aware `smoke_test`"). Resolve the base ref's value the same way, against the **identical** diff paths (`git diff --name-only <pr_base>..<branch>` — the diff decides which scope's command is compared, not the base ref's own history): `git show <git_remote>/<pr_base>:AGENTS.md` and apply the same scope-matching rule. This is a config read, not a test run — one `git show`, no worktree.

- **Both refs resolve to a real command** → the full procedure (§2–§5) runs, and the evidence block (§5) carries `applicable: true`. §2 runs **each ref's own resolved command** in its own worktree; in the ordinary case (a repo's `smoke_test` unchanged between base and branch) the two commands are textually identical and §4's comparison is between the two runs' counts. **Out of reach:** if the two refs resolve to two different *real* commands (the repo changed `smoke_test` to a different, still-real command between base and branch), this procedure still runs both as instructed but has no rule for what a count difference then means — a count comparison is only meaningful for a fixed command, and this section makes no claim about that case.
- **Branch resolves to a no-op** (`true` / `:` / empty) **and the base ref resolves to the same no-op** → the Tester records `evidence: not-applicable — repo declares no executable test command` (`applicable: false`, §5's shape), and §5's merge gate accepts that state. Neither ref runs a worktree — the comparison above is a config read, not an execution.
- **Branch resolves to a no-op and the base ref resolves to a real command** → a **downgrade**, not a no-op: Tester `FAIL` — `smoke_test downgraded to a no-op` (also listed in §4). The config-read comparison above is decisive by itself; no worktree run is needed to reach this verdict.
- **The base ref's `AGENTS.md` cannot be read at all** (e.g. the field predates `pr_base`) → record `base: unavailable (<reason>)` per §4's existing row for an incomplete base run, not a guessed downgrade or no-op.
- **`research` loop type** resolves `applicable: false` with the reason `research loop — doc-quality check, no executable test command`, and its doc-quality checklist (`references/subagent-briefs/research-implementer.md`, "Tester check criteria") is unchanged. No base run, no revert check, no base-ref config read — the loop type alone decides it.
- **The diff is docs-only** → see "Docs-only bypass" above: this whole procedure does not run.

#### §2 — Base run: a second, throwaway worktree

Before running the resolved command on the branch, the Tester produces a reference run at `pr_base`, in its own detached worktree:

```bash
git -C <repo_path> worktree add --detach <tmp_dir>/<slug-safe>-<issue>-base <git_remote>/<pr_base>
```

**Same pattern, same teardown discipline** as the loop's primary worktree — canonical in "Git worktree isolation" → "Cleanup — worktree, then local branch" and its non-fatal fallback: detached and throwaway, removed (`git worktree remove --force`, falling back to `git worktree prune` on removal failure per the documented non-fatal fallback) on **every** exit path this stage can take (PASS, FAIL, ESCALATE via the Critic), a failed removal reported and never fatal. A detached worktree carries no local branch of its own, so only the worktree-removal half of that rule applies here — there is nothing for the branch-delete half to do.

**Scope resolution is shared with the smoke test above:** resolve the scope from the branch diff (`git diff --name-only <pr_base>..<branch>`, per "Scope-aware `smoke_test`"), then run each worktree's own §1-resolved command (identical in the ordinary case; see §1's "out of reach" note for when they differ), so the two runs are comparable.

Record from each run:

- `collected` — the number of test cases the runner collected (pytest `collected N items`, jest `Tests: N total`, go `ok`/`--- PASS` count, or the runner's own equivalent). Where the runner emits no count this plugin can parse, record `collected: unknown` — a value distinct from `0`, handled in §4.
- `passed`, `failed`.
- `skips` — the **set** of skip identifiers, not a count: every skip reason the runner itself reports, plus every skip this plugin applies **within a run that executes** — `scope_not_applicable`, `parallel_unsafe` (see the Tester skip rules), and the code-graph pre-flight's three degradation states (`namespace absent`, `project unknown`, `tool inconsistent`). `docs_only` is never a member of this set: it marks a full-stage bypass recorded *before* this procedure ever runs (see "Docs-only bypass" above), and a run that never executes cannot feed a within-run skip set.

#### §3 — Revert check: a new test must fail without its change

For every test path the diff adds or modifies, prove the test depends on the production change it ships with. A path is a **test path** when it matches the optional `test_globs` AGENTS.md field:

```yaml
work-issue:
  test_globs:                 # optional; absent → the revert check records `unavailable`
    - "tests/**"
    - "**/*_test.go"
    - "**/*.test.ts"
```

- **`test_globs` absent** → the revert check is **not silently skipped**: record `revert_check: unavailable — no test_globs declared`.
- **The diff adds or modifies no path matching `test_globs`** → `revert_check: n/a — diff adds no tests`. A legitimate value for a pure refactor — but see §4 on a `bug`-labelled issue.
- **The diff touches only paths matching `test_globs`** → `revert_check: n/a — test-only diff`.
- **Otherwise**, in a third throwaway worktree cut from the branch (same detached, every-exit-path teardown discipline as §2):
  ```bash
  git -C <worktree_path> checkout <git_remote>/<pr_base> -- <non-test-paths-in-the-diff>
  ```
  where `<non-test-paths-in-the-diff>` is the diff's path list minus every path matching `test_globs`. Then re-run the resolved command restricted to the added/modified tests. **At least one of them must fail.** If all of them still pass, the tests do not exercise the change: Tester `FAIL` — `new tests pass without the change they accompany`.

#### §4 — Fail conditions (Tester `FAIL`, not a note)

Evaluated after both runs (§2) and the revert check (§3, where it ran) complete:

| Condition | Verdict |
|---|---|
| branch `collected == 0` and base `collected > 0` | FAIL — `0 collected` |
| branch `collected == 0`, whatever the base reported | FAIL — `0 collected` |
| branch `collected` < base `collected` | FAIL — name the delta and the tests that disappeared |
| a skip identifier present on the branch that is not present on the base | FAIL — name the added skip |
| revert check ran and no added/modified test failed | FAIL — `new tests pass without the change they accompany` |
| §1's downgrade — branch `smoke_test` resolves to a no-op while the base ref resolves to a real command | FAIL — `smoke_test downgraded to a no-op` |
| base run itself cannot complete | not a FAIL — record `base: unavailable (<reason>)`. §5's merge gate, not this step, is what turns this state blocking |
| `collected: unknown` on either side | not a FAIL — record it; the count-based rows above are then not evaluable and are recorded as such, not guessed |
| §1's "out of reach" case — base and branch resolve to two different *real* `smoke_test` commands | not a FAIL — same treatment as the `collected: unknown` row above: the count-based rows are not evaluable for this run and are recorded as such, not guessed |

**A note on the removed docs-only qualifier.** An earlier draft of the `collected == 0` row above carried "...and the diff is not docs-only, whatever the base reported". That qualifier is removed here: a docs-only diff never reaches this table at all (see "Docs-only bypass" above, which bypasses this whole procedure — §4 included — before §1 is ever evaluated), so the qualifier was dead text that no execution path could evaluate. If a future change lets a docs-only diff reach §4 by some other route, the qualifier would need to return.

A FAIL here is a **Tester FAIL like any other**: it reaches the Critic, which decides REVISE or ESCALATE under the existing 3-revise cap (see "Stage 4 — Critic"). It never bypasses the Critic and introduces no new terminal verdict.

**A `bug`-labelled issue reporting `revert_check: n/a — diff adds no tests` is not itself a FAIL** — a legitimate fix can be a one-line guard with no new test — but the Critic raises it as a **named finding** (step 4 of the Critic briefing, "Evaluate Tester findings"): a bug fix that adds no regression test is worth a human's attention even where nothing here blocks it.

#### §5 — The evidence block, and the Closer's merge gate

The Tester's stage comment carries a fenced, machine-readable block after the per-AC section:

```yaml
evidence:
  applicable: true            # §1
  command: "<resolved smoke command>"
  base:  { ref: "<sha>", collected: 412, passed: 412, failed: 0, skips: ["slow"] }
  head:  { ref: "<sha>", collected: 415, passed: 415, failed: 0, skips: ["slow"] }
  revert_check: { ran: true, reverted_paths: 3, failing_tests: ["test_clip_guard"] }
  verdict: pass                # pass | fail
```

`applicable: false` (§1) is a **fixed, smaller shape** — exactly three keys, never the five above:

```yaml
evidence:
  applicable: false
  reason: "repo declares no executable test command"   # verbatim the §1 reason string for whichever case fired
  verdict: pass                # pass for a legitimate no-op both sides or the research resolution; fail for the §1 downgrade
```

No `base` / `head` / `revert_check` keys on this shape — there is nothing to compare, and none is invented. `verdict:` is present on **both** shapes so the Closer's gate below always has a defined key to read, regardless of `applicable`.

**The Closer's in-loop merge gate.** Before it squash-merges (Closer step 4), the Closer reads this block from the issue thread — the Tester's latest comment, if the Tester ran more than once across revise cycles — and **quotes it verbatim** in its own terminal stage comment, so a later reader finds it without re-reading the whole thread.

**"Missing" has two causes, and only one blocks.** The current round's state carries `skip_tester_round_N: docs_only` when the whole Tester stage was bypassed (see "Docs-only bypass" above) — there the absence is expected and recorded, and the gate treats it exactly like a `verdict: pass` / `applicable: false` block: **not blocking**. A block absent for any other reason — the Tester stage ran this round (no `skip_tester_round_N` entry) and simply did not post one — is the "missing" this gate blocks on. That genuinely missing block, together with `verdict: fail`, or `base: unavailable` while the repo's resolved `smoke_test` is a real command (§1), **blocks the merge**: the Closer does not merge, does not close the issue, and exits `ESCALATE: CI pending` — the same literal marker "No silent Closer termination" uses for a pending check. The Closer's stage comment names the cause with the literal tag `evidence-gate: <missing | fail | base-unavailable>` — this is what the Pre-Flight open-PR check's resume-gate branch reads to route a re-run (see "Pre-Flight stage 0") — alongside, or instead of, a pending-check reason, and releases the claim per the uniform claim rule ("Closer merge behavior"). `applicable: false` reported on both sides because `smoke_test` itself resolves to a no-op is **not** blocking; the case this gate blocks on beyond a genuinely missing block is the §1 downgrade (a real base command, a no-op branch), which is already a Tester `FAIL` before the Closer is ever reached — the gate is a second, independent check against the same regression, not a new way to reach it.

This is what moves the Closer's gate from the level of check *conclusions* (see "CI base-vs-PR baseline" below, unchanged by this section) to the level of test *execution*.

### Closer merge behavior (in-loop merge) — canonical definition

The Closer always **merges in-loop**: once the Critic APPROVEs and CI is green, it squash-merges the PR to `<pr_base>`, closes the issue, deletes the remote branch, and runs the one deploy. There is **no policy to choose** — this is the only behavior. **This section is the canonical source for the Closer's merge and claim handling** — every other mention (CLAUDE.md, `/loop`, the ADRs) points here instead of restating it.

A leftover `merge_policy:` key in an existing AGENTS.md is **inert** — it is not read, is not in the mandatory-field completeness check, and never STOPs. Rationale, evidence, and the recorded default flip: ADR 0007 (`docs/adr/`), which supersedes the earlier ADRs 0004 and 0005 by note.

**The Closer's terminal verdicts.** The Closer runs steps 0–11 plus 3a (commit identity, PR create, CI base-vs-PR baseline, bounded CI polling, the execution-evidence merge gate, squash-merge, issue close, drift check, deploy, cleanup, terminal comment, state) — `3a` to avoid colliding with the unrelated top-level "Stage 3.5 — Visual Reviewer". It reaches exactly one of:

- **`merged` (& deployed)** — the normal terminal. The squash-merge closes the issue (via `Closes #N`, or explicitly for a non-default `pr_base`), so the issue leaves the pool; the Closer then explicitly **retires** its claim (see "Claim retirement on success" below) rather than releasing it — no assignee removal, no `## [claim:released]` note, since there is no pool to return the issue to.
- **`ESCALATE: CI pending`** — merge-relevant checks are still pending at the polling cap, **or step 3a's execution-evidence gate blocks the merge** (see "Execution evidence" §5). Either cause is left **open** and the claim is **released** (see the uniform claim rule below). A re-run of `/work-issue <n>` is routed by the Pre-Flight open-PR check to whichever path recovers this PR — straight to the Closer merge steps once CI is green, or through a fresh Tester pass first when the prior exit named an `evidence-gate:` cause (see "Pre-Flight stage 0").

Terminal cleanup (worktree **and** local branch) runs on both — the branch is pushed to `<git_remote>`, so both are disposable scratch and the resume operates from the remote if needed; see "Git worktree isolation" → "Cleanup — worktree, then local branch".

**Uniform claim rule — the Closer never holds a claim on an open PR.** Every Closer terminal exit that leaves the PR open — today only `ESCALATE: CI pending` — releases the claim (label + assignee + `## [claim:released]` note). Holding it would add nothing: the duplicate-work guard is the **open PR itself**, not the label — the Pre-Flight stage 0 **open-PR check** guards any later `/work-issue` run on this issue while its PR is open (see "Pre-Flight stage 0"), independently of whether the claim label is still there. (An earlier version of this rule argued a held claim would have no reachable release point at all, because the stale-claim reclaim could never see anything but continuing activity behind the run's own stage comments — that argument no longer holds now that staleness ignores stage comments entirely, see "Claim protocol", "Activity"; the conclusion is unchanged, and now rests on the simpler ground stated above. Full account: `docs/adr/0024-claim-lifecycle.md`.) The one exit that does not run a release is `merged`, where the issue is closed and the claim is explicitly **retired** rather than released — see "Claim retirement on success" immediately below.

**Claim retirement on success — canonical statement.** The `merged` verdict is the one terminal exit the rule above does not cover, because it never leaves a PR open. It is not silent about the claim either: right after the issue is closed (step 5, either branch — auto-close on a default `pr_base`, or the explicit close on a divergent one), the Closer retires its own claim:

1. Remove the issue's own label: `gh issue edit <n> --remove-label claimed:<agent-id>`.
2. Check whether **any other issue, open or closed** (`--state all`, the same reach the `goal:`/`waiting-on:` label checks use, for the same reason — a superseded state is never silently ignored), still carries that exact label: `gh issue list --repo <slug> --label claimed:<agent-id> --state all --json number`.
3. **None found** → delete the repo label itself: `gh label delete claimed:<agent-id> --yes`. **At least one found** → leave the repo label in place, untouched.

The order is load-bearing: step 1 removes the closing issue's own copy *before* step 2 counts, so the issue being closed never counts as its own reason to keep the label alive. This is **retirement, not release**: unlike the failure-exit release above, there is no assignee removal and no separate `## [claim:released]` note — the outcome is already carried in step 10's terminal comment, and the issue has left the pool either way, so a release note would add nothing. Never delete a repo label another issue still carries — the `--state all` check exists exactly to honor that, and is what makes this safe under concurrent loops sharing an agent-id prefix but not the id itself (each label name is the full id, so two different ids never share a check). This closes both halves of #138: a merged, closed issue no longer carries a leftover `claimed:*` label, and a repo stops minting one permanent label per green loop — the last issue to carry one deletes it.

**Reporting:** the Closer stage comment and the parent output name the merge outcome — PR number, merge commit, deploy status (or `n/a` for research), or the `ESCALATE: CI pending` escalation — so a reader of the issue thread can tell what happened.

**The squash-merge itself (step 4) carries a non-blocking identity report and an explicit `--subject`/`--body`** — never a precondition on the merge. Mechanics, the two distinct trailer causes, and the ADR: "Squash-merge identity check" below and `skills/github/SKILL.md` §5.

## Codebase-memory requirement (pre-flight)

The skill ALWAYS calls the codebase-memory MCP before stage 1 to give the subagents proper context:

1. **`list_projects`** — check whether `<repo>` is indexed.
2. **If not indexed:** `index_repository` with mode `moderate` (default heuristic).
3. **If indexed:** `index_status` for a freshness check.
   - Threshold: 7 days since last index AND latest commit > index date → auto re-index.
4. **Health check:** if `nodes < 200` OR `source_files < 3` → warn the user:
   > The default heuristic may have excluded important dirs (bin/, docs/, scripts/). Re-index with explicit paths is recommended before the loop runs.

### Code-graph pre-flight — graceful degradation

The codebase-memory (code-graph) MCP is **optional and opportunistic**: any failure falls back to grep-based discovery and **never blocks a loop**. The pre-flight distinguishes **three non-blocking states**, all of which fall back to grep and note a skipped freshness check in the stage comment:

1. **Namespace absent** — the `mcp__*` code-graph tools are not registered at all. Fall back to plain `grep` / `ls`; no freshness check possible.
2. **Project unknown** — the tools respond, but `list_projects` does not list `<repo>` (and an `index_repository` attempt does not resolve it). Fall back to grep; no freshness check.
3. **Tool inconsistent** — the tools disagree about the same project: e.g. `list_projects` lists `<repo>` while `index_status` / `detect_changes` answer "project not found" for the **same** project name **and** the same absolute path. Because the namespace is present, the "namespace absent" fallback does not apply on its own — so treat an inconsistent answer **exactly like an absent namespace**: note it, **skip the freshness check**, and continue with grep-based discovery.

**None of the three blocks.** Whenever the freshness check is skipped for any of these reasons, **record it in the stage comment** ("code-graph freshness check skipped — `<namespace absent | project unknown | tool inconsistent>`; proceeding on grep") so a later reader knows the code-graph evidence was unavailable rather than clean. A fully working code-graph is unchanged.

### Where each tool is used in the loop

- **Validator (stage 1):** `get_architecture` — check the files named in the issue against the graph (do they exist? are they in the cluster?).
- **Implementer (stage 2):** `search_code` for sibling functions + conventions in the repo.
- **Critic (stage 4):** `search_code` per AC checkbox for code evidence ("AC says X, code shows Y").

## Repo registry

Live file: `~/.claude/work-issue-paths.yaml` (persists across plugin updates).
Template: `references/repo-registry.yaml.example` (shipped with the plugin).

Fields per repo:

```yaml
<owner>/<repo>:
  repo_path: /abs/path/to/checkout
  live_path: /abs/path/to/deployed         # optional, for drift check
  default_branch: main | dev
  pr_base: main | dev
  git_remote: origin                       # optional — GitHub working remote for push/PR; falls back to `origin` when unset
  has_dev_branch: true | false             # auto-detected at pre-flight
  syntax_check: "<command>"
  smoke_test: "<command>"                   # plain string OR scope mapping — see "Scope-aware smoke_test" below
  deploy_command: "<command>"
  docs_command: "<command>"                 # regenerates derived docs; "" = not applicable
  agents_md_exists: true | false           # set by /init-agents
```

`git_remote` names the remote the Implementer pushes to and the Closer creates the PR / cleans up branches against. In a repo whose GitHub working remote is not named `origin` (e.g. `origin` is a legacy mirror and the working remote is `upstream`), set it here. When unset it resolves to `origin`, so existing registries are unaffected. It is exposed to the subagent briefs as the `{{git_remote}}` placeholder.

On the first run for a new repo: ask once for `repo_path` + `deploy_command`, persist to the live file. If the live file is missing: `cp` from the template as a bootstrap.

## Pre-Flight stage 0

Run in this order:

1. **Repo-registry lookup** → `repo_path` from `~/.claude/work-issue-paths.yaml`. If missing: ask once for the path.
2. **Claim protocol** — claim the resolved issue before any further work (parallel-safety). See "Claim protocol" below. A lost/already-claimed issue STOPs here — no AGENTS.md check, no open-PR check, no codebase-memory, no stage 1.
3. **AGENTS.md mandatory check** — see the next section. Immediately *before* it runs the **tool availability pre-flight** (see "Tool availability pre-flight" below) — its result is what the YAML-parseability sub-step (§2 of the next section) needs before it can pick a rung. Immediately *after* the AGENTS.md check, at the same STOP tier, runs the **waiting-on actionability check** (any `waiting-on:*` label STOPs — the issue is specified but not actionable; see "Waiting-on actionability check" below).
4. **Open-PR check** — check whether an open PR already exists for this issue:
   ```bash
   gh pr list --repo <slug> --state open --json number,title,headRefName,body \
     --jq '.[] | select((.body | test("(Closes|Fixes|Resolves) #<n>\\b"; "i")) or (.headRefName | test("-<n>$")))'
   ```
   The jq emits **every** matching PR; if more than one is open, name them all. If at least one exists, the issue's implementation work is already done and stages 1–2 never run again — the run **resumes the merge** for that PR instead of re-working the issue, but only for a PR a completed loop produced. (One named exception re-runs stages 3–4 to regenerate execution evidence without touching the implementation — see "the evidence-gate re-entry" below.) An open PR is not by itself evidence that the work passed review, and the resume ends in a squash-merge, an issue close and an unattended deploy with no automatic revert. It must therefore clear a bar. Read the issue thread (`gh issue view <n> --json comments`) and require **both**:
   - the Critic's approval — `## [stage:critic] APPROVE`, and
   - a Closer terminal comment from a completed loop — `## [stage:closer] ESCALATE: CI pending` — **which must name this PR's number**. That comment carries it (see the Closer's CI-pending exit, step 3). A Closer terminal comment for a *different* PR is not evidence about this one: the thread proves the issue was reviewed, not that the PR about to be merged was. Without that binding a second matching PR — a teammate's hand-opened `Fixes #<n>`, or any match on a reopened issue whose thread still carries an old loop's verdicts — would ride in on another PR's approval.

   **Exactly one PR matched and both markers name it → resume.** Pre-flight first continues through steps 5–10 as normal — `loop_type` (step 6) is mandatory and the Closer branches on it at step 7 (`code` deploys, `research` does not) and step 10 (`merged & deployed` vs `merged`), so the hand-off must not jump the queue.

   **The named Closer comment decides *where* the resume hands off.** Read it for the literal `evidence-gate: <missing | fail | base-unavailable>` tag (see "Execution evidence" §5 and Closer step 3a):

   - **Tag absent** (the prior exit was a pure CI-pending poll/wallclock cap, no evidence-gate cause) → hand the run straight to Stage 5 (Closer) for the existing PR, exactly as before this revision: Closer steps 2, 3 and 3a (CI base-vs-PR baseline, bounded CI polling, the execution-evidence merge gate) and, once none of the three blocks, steps 4–7 (squash-merge, issue close, drift check, deploy), then the terminal comment and state steps (10–11). Steps 0–1 are skipped (no new commits, the PR exists) and step 9 is a no-op on **this** path (this run created neither a worktree nor a branch, and the cleanup rule only covers what the run itself created) — the evidence-gate re-entry below is a different path through this same step 4 and does create both, so its step 9 is not a no-op; see its own cleanup note.
   - **Tag present** (the prior exit blocked on the evidence gate) → hand the run to a **fresh Stage 3 (Tester)** pass first — the "evidence-gate re-entry". Recreate a worktree tracking the existing remote branch (the original was torn down at the prior exit, since terminal cleanup runs on every path that leaves a PR open too):
     ```bash
     git -C <repo_path> worktree add -B <branch> <tmp-dir>/<slug-safe>-<issue> <git_remote>/<branch>
     ```
     — a normal, non-detached worktree, exactly like a fresh stage-2 hand-off (see "Git worktree isolation"), and, exactly like that hand-off, write the resulting path into the state tracker as `worktree_path` — this is what lets the standard cleanup rule below find it at this run's terminal verdict. Then run Stage 3 exactly as briefed, producing a fresh `evidence:` block. This one path carries an explicit, narrow exception to Stage 3's normal parent decision ("Parent decision: FAIL → stage 4. PASS → stage 4."): here, **FAIL → stage 4 (Critic)**, unchanged — a genuine regression still goes through REVISE/ESCALATE under the existing 3-revise cap, exactly like any other Tester FAIL reaching the Critic for the first time. **PASS, or a resolved blocking state (the missing/base-unavailable cause no longer holds) → skip stage 4 and go straight to the Closer merge steps named in the bullet above (2, 3, 3a, then 4–7).** The diff itself has not changed and already carries a live `## [stage:critic] APPROVE` on this thread; what is being regenerated is the evidence artifact, not a fresh implementation needing fresh review, and this path never calls step 1 (`gh pr create`) — the PR it is servicing already exists. A REVISE at this Tester FAIL produces new commits on the branch through the normal Implementer round, which returns here to a fresh Pre-Flight open-PR check on its next run, same as any other revise round; the worktree and branch this re-entry created are cleaned up on whichever terminal verdict that eventually reaches, per the standard cleanup rule.

   This is what makes the documented CI-pending recovery — "re-run `/work-issue <n>` once CI is green, or once the evidence is fixed" — actually work on both counts: a pure CI wait finishes the merge, and an evidence-gate block gets a real chance to clear rather than re-entering the same blocked gate. If CI is still pending at the polling cap on either branch above, the resume exits `ESCALATE: CI pending` again (releasing the claim, as every terminal exit that leaves a PR open does).

   **Anything else → STOP**, releasing the claim taken in step 2 ("Release on failure" applies — this is a STOP exit). Two cases, each with its own message; both name every matching PR:
   - **Markers missing** (one match, but no `APPROVE` or no Closer comment naming it):
     > PR #<pr> is open for issue #<n> but was not produced by a completed loop (missing: `## [stage:critic] APPROVE` / a Closer terminal comment naming PR #<pr>). This loop does not merge a PR it has not reviewed. Review and merge it yourself, or close it, then re-run `/work-issue <n>`.
   - **More than one match** — the resume is defined for exactly one PR and must not choose between candidates:
     > Issue #<n> has more than one open PR (#<pr-a>, #<pr-b>). The resume merges exactly one PR and cannot choose. Close the ones that do not belong, then re-run `/work-issue <n>`.

     Advise **closing** the strays, not merging them: a PR typically matched because its body says `Closes #<n>`, so merging it would close the issue. Merging a stray is only safe if it is in fact the right PR — in which case the issue is done and no re-run is needed.

   The PR matcher above is a heuristic (branch suffix, or `Closes #<n>` in the body), so it has a false-positive surface — an unrelated hand-opened PR can match. A false positive would otherwise cost an unreviewed merge plus a live deploy. The gate is what makes the heuristic fail toward the safe side — but only because the evidence is bound to the PR being merged and multiplicity is refused rather than resolved. A thread-scoped check would leave the heuristic riding on a different PR's review.

   The duplicate-work guard is real: an open PR means stages 1–2 (the spec review and the implementation) can never be re-run — the run is routed past them once exactly one PR matched and it carries this loop's review evidence, and halted otherwise (an ungated PR and an ambiguous multi-PR match both STOP). The one named exception is the evidence-gate re-entry above, which re-runs stage 3 (and, on a FAIL, stage 4) to regenerate a missing or failed artifact for a diff that has **not** changed — never a re-implementation, never a second look at a spec already reviewed. Unreviewed work is never merged. The guard lives on the PR rather than the claim label because the Closer **releases** the claim on `ESCALATE: CI pending` — the one terminal exit that leaves a PR open (see "Closer merge behavior"): the open PR is a stronger signal than a claim label — created by the same run, never orphaned by a cleanup step that did not run, gone exactly when the work is genuinely done.
5. **Codebase-memory pre-flight** (see above: list_projects → index/freshness → health check).
6. **Loop-type resolution** — see the next section.
7. **Determine default branch:** `gh api repos/<slug> --jq .default_branch` (cross-check against the AGENTS.md value).
8. **Check for `dev` branch existence:** `gh api repos/<slug>/branches/dev` → 200 or 404 (info only).
9. **Live-path drift check** (if `live_path != repo_path`): `diff -r <live_path> <repo_path>` → on drift, warn the user before stage 1.
10. **Channel inbound detection:** on a `<channel>` tag → short reply "Loop for <slug>#<n> starting (`loop-type:<type>`), stage 1 running." On an open-PR resume (step 4) stage 1 never runs, so send instead: "Resuming <slug>#<n> at the merge for PR #<pr> — stages 1–4 already done." Never announce a stage that will not run: on this path the next thing that happens is an unattended merge and deploy.
11. **Time-budget line** — see "Resolved time budgets (pre-flight line)" below. One line, before stage 1, on every run.

### Claim protocol

`/work-issue` is **parallel-safe**: two agents/terminals may run it concurrently on the same repo. Before any work, an agent **claims** the issue so no two runs collide on the same one. This runs right after issue-number resolution and the repo-registry lookup, before the AGENTS.md check, the open-PR check, the codebase-memory pre-flight and the Validator. (The open-PR check runs *after* the claim so that a run which STOPs there — an ungated or multi-PR match — releases the claim it just took.)

**`<agent-id>` derivation (stated here once).** Each run has an `<agent-id>`, used in the label and the claim comment. Derive it as `<hostname>-<session>`, where `<session>` is an identifier that is **stable for the whole run and unique across concurrent runs**. Prefer, in order: the harness/session identifier the run already carries (agent harnesses expose one — e.g. a session-UUID prefix, giving ids like `laptop-3bf00557`); else the controlling tty name; else a one-time random suffix generated at claim time and persisted in the state tracker (the retry rule below is what keeps it stable across a retry). Do not use a shell PID — a harness that spawns a fresh shell per tool call makes it neither stable within a run nor unique across concurrent runs — and do not rest uniqueness on any assumption about how many loops a session runs at once: nothing enforces such an assumption, so the id itself must carry the uniqueness. **Retry rule:** before deriving a fresh id, read the state tracker at its deterministic path (`<temp_dir>/loop-<repo_slug_safe>-<issue>.json` — see "State tracker"); if it carries a `claim.agent_id` from an earlier run of this repo+issue, **reuse that id**. A retry thereby recognises its previous attempt's leftover label as its **own** — never a competitor — and the release step (which removes "the run's own" label) removes the right label instead of orphaning it under a fresh id. **Boundary:** this rule applies only where the previous attempt never reached its release step — every release path clears `claim` from the tracker (see "State tracker" and each release step) — so a post-release retry necessarily derives a fresh id. That is correct, not a gap: a released claim is **retired** (see the definitions below), so there is nothing left for the fresh id to reconcile with.

**Definitions (step 2 uses all five — stated here once, nowhere else):**

- **Own claim artifacts** — everything this run's step 1 writes, plus anything left by an earlier attempt under the same `<agent-id>` (see the retry rule): the `## [claim]` comment(s) carrying this `<agent-id>`, the `claimed:<agent-id>` label and its add event, and the `assigned` event its step-1 `--add-assignee` produced, **if any** — on an already-assigned issue that add is a silent no-op and produces no event, which is one reason the assignee is **advisory only** and never identifies a competitor (see step 2.1; the authoritative claim record is the `claimed:<agent-id>` label plus the `## [claim]` comments). Own artifacts are never competitors and never count as activity.
- **Compared timestamp** — every timestamp comparison in this protocol uses GitHub's server-assigned creation timestamp of the comment being compared — the `## [claim]` comment for earliest-wins, the **latest own-id comment** for the `claim_stale_minutes` age (see "Active vs. stale") — never the self-reported ISO value in the comment body, a heartbeat or retry comment's body timestamp included (see step 2's field-naming note for its per-command spelling). `created_at` is assigned by a single server clock; under the body-value reading a clock-skewed or misreporting agent wins a tiebreak it should lose. The body timestamp is informational only.
- **Activity** (after a competing claim) — **only** a later comment carrying **that competing claim's own `<agent-id>`**: a duplicate `## [claim]` comment (a retry — see the retry rule), a `## [claim:heartbeat] <agent-id> @ <ts>` (optional — see below), or that same id's own `## [claim:taken-over]` / `## [claim:released]` note, read from `gh issue view --json comments`. **Nothing else is activity for this test** — in particular, a `[stage:*]` progress comment does not count, whoever posted it, including the claiming run's own. Stage comments record what a stage did, not that the run posting it is still alive; crediting them as activity is exactly what let a dead run's last `## [stage:validator] GO` keep its own claim reading as active indefinitely (#138) — only a human removing the label could unblock the issue. Label additions/removals and assignment changes are likewise not activity for this test: they already have their own, narrower roles elsewhere (`unlabeled` for retirement below, `assigned`/`unassigned` for the 2.1 residue test) and do not also feed staleness. Issue-body edits were never comments, so they were never in scope even under the wider reading this replaces, and nothing here changes that. **The "excluding this run's own claim artifacts" carve-out this bullet used to need is now automatic, not a separate exclusion**: the test only ever asks about comments carrying the *competing* claim's id, and the evaluating run's own comments carry its own, different id, so there is nothing of its own left to exclude by name. This narrowing is what closes the blocking direction of #138; the full account, including why it is the run's own id that must refresh liveness rather than any observer's activity, is `docs/adr/0024-claim-lifecycle.md`.
- **Active vs. stale** — a competing claim is **active** iff its **latest own-id comment** — its `## [claim]` comment, or any later comment carrying the same id per "Activity" above (a retry's duplicate `## [claim]`, a heartbeat, or a `[claim:taken-over]` / `[claim:released]` note) — is younger than **`claim_stale_minutes`** (default 60 min — a named constant, not an AGENTS.md field; ADR 0020 §8 records the decision to keep it a hardcoded default, unchanged here). Latest own-id comment older than `claim_stale_minutes` → **stale** (abandoned) — even when other comments, including the claiming run's own stage comments, followed it. This is a single test, not two: a later same-id comment does not revive a claim by existing, only by being itself recent enough — an old duplicate `## [claim]` from a dead retry is exactly as stale as a claim with no duplicate at all. The age compares that comment's server timestamp against the run's **own clock**; unlike earliest-wins (two server timestamps) this comparison is skew-exposed, and a run skewed by more than `claim_stale_minutes` can misjudge staleness in either direction — accepted, since no documented command supplies a cheap server-side *now*. Both terms apply to non-retired claims only — a retired claim (next bullet) is tested for neither.
- **Retired claim** — a claim is **retired** iff the issue timeline (read via step 2's timeline fetch) carries an **`unlabeled` event for its `claimed:<id>` label** with a `created_at` later than the claim's start (its `## [claim]` comment's creation timestamp; its `labeled` event's for a label-only claim). That is the whole rule — the rest of this bullet is rationale. Retirement is **structural, keyed on the label, never on note text or author**: the label carries the agent-id inherently; **every** release path already removes it, including the one that posts no release note at all (the divergent-base close); and neither notes nor authorship could carry it — no spec'd release-note format names an id, and where runs share one GitHub login (see step 2.1) the author cannot distinguish runs. The `## [claim:released]` / `## [claim:taken-over]` notes are **audit trail only**, never the mechanism. Retirement is per-**id**: one `unlabeled` event retires every `## [claim]` comment carrying that id (a retry may have posted duplicates), while the later-than clause keeps a reused id's fresh claim alive against an old removal. **Fail-safe:** a crashed run leaves no `unlabeled` event → **not** retired → it correctly stays a competitor and falls to the staleness filter; a human can free a wedged claim by simply removing its label. A retired claim is **neither active nor stale — it never enters the competitor set and never enters the earliest-wins tiebreak.** Load-bearing because comments are immortal thread history: no release path deletes the claim comment, so without retirement every released claim would remain "active" forever under the old, wider activity reading and win every future earliest-wins tiebreak — an issue could never be claimed twice; under the narrower "Activity" rule above the same protection is now also structural rather than incidental, since a released claim's own note carries its own (retired) id and a different claim's id is never affected by it either way. Retirement is what makes a release actually return the issue to the pool; it is evaluated only on open issues — a closed issue has left the pool whatever its claim state, and the `merged` path now retires its own label explicitly as part of closing regardless (see "Closer merge behavior", "Claim retirement on success"), so there is nothing left for this definition to reach there. **Activity is no longer symmetric across claims the way it was**: a release note (or a heartbeat, or a taken-over note) carries only its own claim's id, so it is never "activity" for a *different* competing claim's staleness test — each claim's liveness now depends solely on comments bearing its own id, never on what another claim's thread activity happens to be.

**Heartbeat (optional, not one of the five definitions above).** A long-running stage MAY post `## [claim:heartbeat] <agent-id> @ <ISO-8601-ts>` — a comment carrying only the claim's own id, nothing else — so a healthy run outliving `claim_stale_minutes` keeps testing active without relying on `[stage:*]` progress comments, which "Activity" above no longer credits. This is infrastructure, not a mandate: no stage brief in this plugin posts one today (wiring it into the five stage briefs is a separate, later change, out of this issue's files-to-touch). Until that follow-up lands, a run whose own loop genuinely runs past `claim_stale_minutes` is, in principle, reclaimable mid-run by a concurrent claim attempt on the *same* issue — accepted here as the honest cost of closing the worse gap (a dead run's claim never expiring at all); a repo whose stages routinely run long can raise `claim_stale_minutes` in the interim. Recorded as a named follow-up in `docs/adr/0024-claim-lifecycle.md`.

**Evaluation order (canonical, stated only here): out-of-band assignment → staleness → earliest-wins.** The staleness test runs **before** the earliest-claim-wins tiebreak, and earliest-wins compares **active** claims only. A stale claim is by definition earlier, so the reverse order would hand it the win and make the reclaim dead code. **This changed with #138**: an issue with stage-comment activity after a claim — even the claiming run's own — no longer keeps that claim active by itself (see "Activity" above); only a same-id claim/heartbeat comment recent enough on its own, per "Active vs. stale", does. What the reordering argument itself does not depend on is which activity rule is in force: staleness still has to run before earliest-wins for the same structural reason as before — a stale claim is earlier by definition, so testing earliest-wins first would still hand it the win.

1. **Claim** the issue (as atomically as GitHub allows). **Read before writing:** capture the **pre-claim snapshot** — the issue's current assignees (`gh issue view <n> --json assignees`) — before the first write; step 2.1 keys on it, and nothing in it can be this run's own. (A retry that reused its `<agent-id>` takes the snapshot from the tracker's `claim.preclaim_assignees` instead of re-reading — the previous attempt's own courtesy add would otherwise masquerade as pre-existing.) Then write, in this order:
   - Add a `claimed:<agent-id>` label: `gh issue edit <n> --add-label claimed:<agent-id>` (create the label first if it does not exist: `gh label create claimed:<agent-id> --color FBCA04 --force`).
   - `gh issue edit <n> --add-assignee @me` — a **visibility courtesy only** (see step 2.1); on an already-assigned issue this is a silent no-op.
   - Post a claim comment: `## [claim] <agent-id> @ <ISO-8601-ts>` (the body timestamp is informational — see "Compared timestamp" above).

   **The label-first order is load-bearing twice.** Label before comment: retirement keys on the label's `unlabeled` event, so a claim comment must never exist whose label never existed — if the label add fails, do **not** post the comment or the assignee; release what was written and stop. Label before assignee: step 2.1's residue test keys on a run's `assigned` event falling **inside** its claim's `[labeled, unlabeled]` window, so the courtesy add must come after the label add — the empirical basis (#46: `labeled` 10:18:23Z, `assigned` 10:18:24Z) already has this order. **Retry idempotence:** a retry that reused its `<agent-id>` (see the retry rule) re-adds only what is missing; a duplicate `## [claim]` comment, if one does get posted, is harmless — retirement is per-id, so one `unlabeled` event retires all comments carrying the id.

2. **Read-after-write confirm** — re-fetch the issue with **two commands** (stated here once; together they are this section's only data source, and every rule below reads from one of them):

   - **Issue state:** `gh issue view <n> --json assignees,labels,comments,state` — current assignees, current labels, all comments, and the issue's open/closed **state** (the Retired-claim bullet's open-issues condition reads it). It has **no timeline field** (`--json timeline` errors), so label/assignment *history* must come from the second command.
   - **Timeline events** — the ***timeline fetch***; the Retired-claim definition, the residue test (2.1) and the label-only earliest-wins fallback (2.3) all read from it:

     ```bash
     gh api repos/<slug>/issues/<n>/timeline --paginate \
       --jq '.[] | select(.event=="labeled" or .event=="unlabeled" or .event=="assigned" or .event=="unassigned")
             | {event, label: .label.name, assignee: .assignee.login, created_at}'
     ```

     **`--paginate` is load-bearing, not hygiene.** A long-lived issue's label churn can exceed one page, and the failure direction of a truncated timeline is the bad one: the claim *comment* still arrives via `gh issue view` (complete), but the `unlabeled` event that retires the claim is silently dropped — the released claim is **un-retired**, re-enters the competitor set, and (being earliest) wins every future earliest-wins tiebreak, so the issue becomes permanently unclaimable. A truncated timeline fails **toward** the deadlock retirement exists to prevent, not away from it.

   **Field naming — the two commands spell the same timestamp differently.** `gh issue view --json` returns camelCase (`createdAt` on a comment); the REST timeline endpoint returns snake_case (`created_at` on an event). Same server clock, per-command spelling: read each field under its own command's name — a `--jq '.created_at'` against `gh issue view` output silently yields null, not an error.

   Discard own claim artifacts, then resolve the remaining competitors in the canonical order:
   1. **Out-of-band assignment (human)** — the assignee is **advisory, never a claim token**: the authoritative claim record is the `claimed:<agent-id>` label plus the `## [claim]` comments, and **no step in this protocol identifies a competitor by assignee or author login**. Reason (load-bearing): the loop and the human may share one GitHub login — in this repo every run *and* the human authenticate as the same login — so "whose assignment is this" is unanswerable from the login, and any rule that branches on it silently misfires (it would unassign the human it means to protect, or route the human's assignment past the STOP that exists for it). The one decidable signal is the **pre-claim snapshot** (step 1): an assignee in it is positively **not** this run's. Two signals, four cases, one outcome each:

      | Pre-claim assignee | `claimed:*` label on the issue (beyond this run's own) | Outcome |
      |---|---|---|
      | none | none | nothing to attribute → continue to 2.2 |
      | none | present | the label is the competitor → 2.2–2.3 resolve it |
      | present | present | assignment presumed claim courtesy; **the label, not the assignee, is the competitor** → 2.2–2.3 resolve it; competitor handling never touches the assignment |
      | present | none | **residue test** (below): loop residue → continue to 2.2; else **out-of-band** → STOP |

      The claim-comment axis folds into the label axis, so it adds no cases: per step 1's write order and the retirement rule, a non-retired claim comment implies its label is present (a comment whose label is gone is retired by that removal — even an out-of-band label deletion by a human counts as releasing that claim); comments are then resolved in 2.2–2.3 like their labels.

      **Residue test (pre-claim assignee, no claim label).** An assignment with no claim label is either a human's or **loop residue** — an assignment written by a claim that was since retired: the 2.2 reclaim deliberately removes a stale claim's label and never its assignee, and a release removes only the releasing run's own entry (`--remove-assignee @me`), so a retired claim's assignee can outlive it without any execution slip (#46 is the empirical case of a slipped release leaving the same state). The two are distinguishable **without login attribution**, from the timeline alone — step 2's timeline fetch supplies every event this test reads. For each pre-claim assignee: take that login's latest `assigned` timeline event with **no later `unassigned` event** — that event marks when the current assignment began (an `--add-assignee` on an already-assigned issue is a silent no-op and emits no event, per "Own claim artifacts", so an older `assigned` event cannot mask a newer assignment). If its `created_at` falls **inside a retired claim's window** — at or after that claim's `claimed:<id>` `labeled` event, at or before its `unlabeled` event, both ends inclusive (timestamps are second-granular and step 1's writes land back-to-back) — the assignment was made by that claim's run: it is **loop residue**. Leave it untouched and **continue to 2.2**. Otherwise it is **out-of-band**: the assignment did not come through this protocol, has no claim timestamp, and is not subject to claim_stale_minutes. Release own artifacts — **label and note only, touch no assignee** (under a shared login `--remove-assignee @me` could remove the very assignment being protected) — and **STOP** with "issue is assigned to `<login>` outside the claim protocol — coordinate with them or unassign, then re-run". The test is safe in both directions: a human assignment made *before* any claim precedes every window's `labeled` event, and one made *after* a release postdates that claim's `unlabeled` event — both correctly STOP; a claiming run's own `assigned` event always lands inside its window because step 1 writes the label first. Reachable by construction: the test keys only on pre-claim state and the timeline, neither of which contains this run's own artifacts. This is the only STOP in this step; never race a human. One deliberate consequence: an assignment made *after* the snapshot sits in this check's blind window — the claim label this run already holds is the coordination signal for that window, as for any mid-run human action. One scope note on assignee removal anywhere in the loop: only a run's own release paths remove an assignee, always `--remove-assignee @me` — under a shared login that may sweep another party's identical entry. That is recoverable, not silent breakage: the swept party re-assigns, and their fresh `assigned` event postdates every claim window, so the next run's residue test correctly STOPs for them. (Note the row-4 check itself *is* a read of the live assignee — taken at step 1 as the pre-claim snapshot — which is exactly why residue must be tested here rather than assumed harmless.)
   2. **Staleness filter (the reclaim, i.e. a takeover)** — for each competing claim (another `claimed:*` label and/or a **non-retired** `## [claim]` comment with another agent-id — a retired claim never enters, see "Retired claim"), test **active vs. stale** per the definitions above. Stale → **take over**: remove the stale `claimed:<stale-id>` label — **the label only; the reclaim touches no assignee** (`--remove-assignee` under a shared login could sweep a human's identical entry — see 2.1). The assignee residue this deliberately leaves is **handled, not harmless by nature**: a later run's 2.1 residue test recognises an assignment that began inside this claim's — now retired — window and routes past the out-of-band STOP, so the residue never blocks the issue. The label removal is itself what **retires** the stale claim for every later evaluator — it writes the `unlabeled` event the "Retired claim" definition keys on. Post `## [claim:taken-over] <stale-agent-id>, stale for <N> min` as the audit trail — `<N>` is the whole-minute age of the stale claim's **latest** own-id comment (its `## [claim]` comment, or a later heartbeat / retry / note carrying the same id, whichever is most recent — see "Heartbeat") against this run's clock, the same comparison "Active vs. stale" already made to reach this branch — and drop the claim from the competitor set. This run's own step-1 claim already stands, so nothing is re-posted. **Branch reuse:** before Stage 2 cuts a worktree, check whether the stale run left a remote branch for this issue (`git -C <repo_path> ls-remote --heads <git_remote> <branch>`); if it did, Stage 2 tracks it instead of starting over — see "Git worktree isolation", "Branch reuse on takeover" — so a takeover never produces a second branch for the same issue and never silently discards the dead run's pushed commits.
   3. **Earliest-wins tiebreak (active claims only)** — among the claims that survived the filter (own included), the earliest compared timestamp wins (see "Compared timestamp" for which command supplies it and its per-command spelling). For a competitor with a `claimed:*` label but no `## [claim]` comment (a run that died between its label add and its comment post), use the `created_at` of its `labeled` timeline event (from step 2's timeline fetch; snake_case per the field-naming note) — same server clock. If this run is the **loser**: **release** — remove its own `claimed:<agent-id>` label and its assignee (`gh issue edit <n> --remove-label claimed:<agent-id> --remove-assignee @me`), post a `## [claim:released]` note, and **STOP** with "already claimed by `<other-agent-id>`". No stage 1. If this run is the **winner** (or no competitor survived the filter): continue.

On a successful claim, write `claim: { agent_id, claimed_at, preclaim_assignees }` into the state tracker before continuing — the pre-claim snapshot must survive into a retry, which cannot reconstruct it from a fresh read (see step 1). The claim is **released on any failure exit** (STOP / ESCALATE / hard-cap / abort) so the issue returns to the pool — see "Release on failure" and each stage's exit note.

### Tool availability pre-flight

**Canonical list, derivation, per-tool status and the YAML-parseability fallback chain: `skills/
work-issue/references/tool-requirements.md`.** Not restated here — this section states only where
the probe runs and its report/STOP posture, which is what a pre-flight reader needs; the table
itself, the search that derived it, and the ugrep finding live in that one file (AGENTS.md
hard-gate 8).

Runs immediately before the AGENTS.md mandatory check (its YAML-parseability sub-step, §2 below,
needs the result to pick a rung). Probe exactly the rows the canonical list marks **Probed: yes**
— no more, no less; which rows those are, why a `required` row can still be unprobed
(foundational infrastructure the pre-flight could not have started without), and the exact
presence-check command are canonical in `tool-requirements.md`, "The list" and "Probing".

**Posture, and the one exception to it, are canonical in `tool-requirements.md`, "Report vs.
STOP"** — not restated here: a report, never a STOP, printed once before stage 1, silent when
clean, with one named exception for a tool a mandatory step has no rung left for. Read it there.

**Substitution is never silent — stated once, here, applying to every stage.** Any stage that
substitutes a tool or narrows a check because something is absent states it in its own stage
comment, the same posture `docs_command` already follows by distinguishing a declared-empty
command from an absent field. This pre-flight's report covers what was found before stage 1; a
stage that discovers its own gap mid-run is not exempt from the same rule. (`tool-requirements.md`
points back here for this one rule rather than restating it — the cross-stage behavioural rules
that bind all five stages live in this file, not in a `references/` table.)

### AGENTS.md mandatory check

Before stage 1, check in this order — every failure is a **STOP verdict** (no stage 1, no subagent start).

1. **Existence**: `ls <repo_path>/AGENTS.md`
   - Missing → STOP:
     > AGENTS.md is missing at the repo root (`<repo_path>/AGENTS.md`). Please run `/init-agents --repo <slug>` first to create the standards spec. Then re-run `/work-issue <num> --repo <slug>`.

2. **YAML parseability** — run the **`python3` → `node` → structural-scan** fallback chain (canonical, including each rung's exact command and tested coverage boundary: `skills/work-issue/references/tool-requirements.md`, "The YAML-parseability fallback chain"). Use the tool-availability pre-flight's result (previous section) to pick the first available rung; note in the pre-flight report which rung was actually used whenever it is not rung 1.
   - A rung reporting a syntax error → STOP:
     > AGENTS.md has a syntax error in the YAML frontmatter: `<error-message>` (line `<line>`). Please fix or call `/init-agents --refine --repo <slug>` to reset fields.
   - **Rung 2 reporting a load failure is not a syntax error** — degrade to rung 3 and note the degrade in the pre-flight report, the same as `node`'s own absence; canonical distinction and the exit-code contract that makes it detectable: `tool-requirements.md`, "The YAML-parseability fallback chain", rung 2, "A load failure is not a syntax error". Do not map it to the STOP above.
   - No rung available at all (`python3`, `node`, **and** `grep`/`sed` all absent) → STOP with the message canonical in the same reference file — see "Tool availability pre-flight" above, "The one exception".

3. **Completeness**: all 11 fields in the `work-issue:` namespace are set (`branch_pattern`, `default_branch`, `pr_base`, `commit_format`, `syntax_check`, `smoke_test`, `deploy_command`, `linter`, `hard_gates`, `default_oos`, `ac_templates`). An empty string is a valid value and means "not applicable in this repo" — a MISSING key is not the same thing and fails the check.

   **`docs_command` is OPTIONAL** and is deliberately **not** in this list. Rationale below.
   - Missing fields → STOP:
     > AGENTS.md is incomplete. Missing fields: `<list>`. Please call `/init-agents --refine --repo <slug>` to add them.

   Note: empty lists (`[]`) and empty strings (`""`) count as set — `deploy_command: ""` is allowed, `deploy_command` missing is STOP.

   **`commit_identity` is OPTIONAL** and is **not** part of this mandatory 11-field completeness check. An existing AGENTS.md without a `commit_identity` block must **not** STOP here — cache it as absent. Only when present, cache its `name`/`email`. What the committing stages then do with either state is the commit-identity convention, canonical in `skills/github/SKILL.md` §2 and transcluded into their briefs.

   **`models:` is OPTIONAL** and is **not** part of this mandatory 11-field completeness check. An existing AGENTS.md without a `models:` block must **not** STOP here — cache it as absent and let every stage inherit the session model (zero behavior change). Only when present, cache the per-stage alias map for the stage-spawn logic below. Partial blocks are legal: only the keys present are overridden; missing stage keys inherit the session model.

   **`effort:` is OPTIONAL** on exactly the same terms and is likewise **not** part of the 11-field check. An existing AGENTS.md without an `effort:` block must **not** STOP here — cache it as absent and let every stage run at the API/session default (zero behavior change). Only when present, cache the per-stage level map. Partial blocks are legal: only the keys present are overridden; missing stage keys run at the default.

   **`wallclock_cap_min` is OPTIONAL** and is **not** part of this mandatory 11-field completeness check — the same posture as `models:` and `effort:`. An existing AGENTS.md without it must **not** STOP here: cache the documented default instead. It is the loop's own time budget, in minutes; its default and its reasoning are canonical in "Hard caps", and why it is a field rather than a literal is recorded in `docs/adr/0020-split-time-budgets.md`.

   **`ci_poll_cap_min` is OPTIONAL** on exactly the same terms and is likewise **not** part of the 11-field check. It is the Closer's CI-poll budget, in minutes, and it is **not** the wallclock's remainder: when it is absent the poll gets its own documented default (canonical in "Hard caps"), never whatever is left of the loop budget. Caching it absent is zero behaviour change for the *field*; that the poll no longer draws on the loop wallclock is the behaviour change this pair ships — see `docs/adr/0020-split-time-budgets.md`.

   **`test_globs` is OPTIONAL** and is likewise **not** part of this mandatory 11-field completeness check. An existing AGENTS.md without it must **not** STOP here — cache it as absent. It names the glob patterns that identify test paths in a diff, read only by the execution-evidence revert check (§3 under "Execution evidence" below); absent, §3's own recorded state applies — named once there, not repeated here.

4. **Optional `components:` block** — if present at the top level of the frontmatter, cache it too. Fields when present: `registry_path` (string, required), `code_globs` (list of glob strings, required), `usage_policy` (`prefer_existing` | `strict`, default `prefer_existing`), `scope` (`frontend` | `backend` | `both`, default `both`). Absence is fine — the loop then skips all registry gates cleanly (zero behavior change). Presence with missing required fields → STOP with a hint to `/init-agents --refine`.

5. **Optional `visual:` block** — if present at the top level of the frontmatter, cache it too. Fields when present: `serve_command` (string, required), `base_url` (string, required), `viewports` (list, default `[{w:390,h:844,label:mobile},{w:1280,h:800,label:desktop}]`), `routes` (list, default `["/"]`), `console_error_policy` (`fail` | `warn`, default `fail`), `screenshot_dir` (string, optional), `scope` (`frontend`, default `frontend`). Absence is fine — the Visual Reviewer stage (3.5) is then skipped cleanly (zero behavior change). Presence with a missing required field → STOP with a hint to `/init-agents --refine`.

6. **Optional `models:` and `effort:` blocks** (inside `work-issue:`) — if present, cache the per-stage alias map and the per-stage level map. Both blocks take the same six keys: `validator`, `implementer`, `tester`, `visual`, `critic`, `closer`. Valid values: for `models:`, aliases only (`opus`, `sonnet`, `haiku`, `fable`); for `effort:`, levels only (`low`, `medium`, `high`, `xhigh`, `max`). Absence is fine on either axis — every stage then inherits the session model and runs at the API/session default effort (zero behavior change). Partial blocks are legal; unset stage keys inherit on the model axis and run at the default on the effort axis. **Unlike steps 4 and 5, this step never STOPs on either block.** An unrecognised stage key (e.g. `models.reviewer: opus`, `effort.reviewer: low`) is **ignored with a note in the loop output** — never a STOP; the same applies to an unknown alias value and to an unknown level (see "Model and effort resolution (per stage)"). Neither `models.visual` nor `effort.visual` is **ever** used to trigger the Visual Reviewer stage — that gate fires only when the `visual:` block is present AND the issue is frontend-scoped (see step 5). A `models.visual` or `effort.visual` value in a repo without a `visual:` block is cached silently and ignored.

7. **Optional `strategy:` block** — if present at the top level of the frontmatter, cache it. Absence is fine and is the default. **This step never STOPs**, and `strategy:` is explicitly **not** part of the mandatory field-completeness list in step 3 — a missing block, a partial block or an unknown key inside it is never an error. When `strategy.gates` is present, run the consistency report described in the next section; when it is absent, produce no report and no output line at all.

8. **Optional `wallclock_cap_min` and `ci_poll_cap_min`** (inside `work-issue:`) — the loop's two time budgets, both in whole minutes. If present, cache each under `standards`; if absent, cache the documented default from "Hard caps". **This step never STOPs, on any input.** A value that is missing, non-numeric, zero or negative falls back to that field's default, is noted once in the pre-flight output (step 11 below) and the run continues — the same prefer-and-degrade posture `models:` and `effort:` have, and for the same reason: a time budget must never be the thing that stops a loop. The two axes fall back independently. Each resolves L1 (`work-issue.<field>` in AGENTS.md) → L2 (the same key nested under `work-issue:` in the issue's `## Standards Override` block, consistent with every other overridable field) → the documented default; a top-level key in the override block is not read.

A legacy `merge_policy` field, if it lingers in an existing AGENTS.md, is **ignored** — it is not read, not cached, and never STOPs (the in-loop merge is the only behavior now; see "Closer merge behavior").

If all three mandatory checks pass (plus the optional-field parse): cache the frontmatter and keep the body available for stage briefings. This cache is the source for all standards values in the subagent briefings.

### Optional `strategy.gates` consistency report

**This section is the canonical definition of what "unconfigured" means per gate, and of the report itself.** What each gate *injects* at issue-creation time is canonical in `skills/create-issue/SKILL.md`, section "Strategic Gates"; the block's shape and opt-in semantics are canonical in the repo's root `AGENTS.md`. Neither is restated here.

A gate is a promise about a mechanism that lives elsewhere. When the gate is `true` and that mechanism is not configured, the repo has promised something it cannot keep — worth saying out loud, worth nothing to block on.

**This is a report, never a STOP.** It does not stop the run, does not gate a stage, does not need to be waived, and is not part of the step-3 completeness check. A repo must be able to switch gates on one at a time and work through them; refusing to run until every gate has its mechanism would make incremental adoption impossible.

**Absent `strategy.gates` → no report and no output line.** A gate set to `false` is treated exactly like an absent gate and is never reported.

| Gate (`true`) | Fields / artifacts read | "Unconfigured" means | Report line |
|---|---|---|---|
| `architecture_adr` | the `docs/adr/` directory in the repo | `docs/adr/` does not exist (`ls <repo_path>/docs/adr`) | `strategy.gates.architecture_adr is on, but the repo has no docs/adr/ directory — the ADR the gate asks for has nowhere to land yet (the first ADR creates it).` |
| `component_reuse` | the `components:` block (step 4) | the block is absent | `strategy.gates.component_reuse is on, but AGENTS.md declares no components: block — the Component Reuse Check has no registry to check against.` |
| `test_evidence` | `smoke_test`, `ac_templates` | `smoke_test` is the **empty string** **and** `ac_templates` is **empty** — both declared no-ops | `strategy.gates.test_evidence is on, but smoke_test is "" and ac_templates is empty — the gate has no evidence mechanism to require.` |
| `documentation` | `docs_command`, `ac_templates` | `docs_command` is `""` **or** the field is absent, **and** the docs AC-template lookup finds no match | `strategy.gates.documentation is on, but docs_command is <declared "" / not declared in AGENTS.md> and no ac_templates entry concerns documentation — the gate has nothing to require.` |

Notes that make the rows testable:

- **`test_evidence` is configured whenever *either* mechanism is real.** `smoke_test` and `ac_templates` are mandatory fields, so neither is ever *missing* — but both may legally be declared no-ops (`""` and `[]`), and only that combination is reported. A repo with a non-empty `ac_templates` is configured even when `smoke_test` is a no-op command, and a repo with a real `smoke_test` is configured even with an empty `ac_templates`. Consequence, deliberately: this gate is silent in almost every repo, including this one, and never fires on a run just because it is switched on.
- **`documentation` reads the same three-state distinction the Tester uses** for `docs_command` (real command / declared `""` / absent field — canonical at the Tester's regenerate step). Name which of the two empty states it was in the report, exactly as the Tester does. The docs AC-template lookup is canonical in `skills/create-issue/SKILL.md`, "Documentation Check and the docs AC-template lookup" — do not re-derive it here.
- **`architecture_adr` is the one gate with no AGENTS.md field behind it.** Its mechanism is the ADR practice and the AC text `create-issue` injects; the only thing that can be missing is the directory the ADR is asked to live in. The report is informational and clears itself with the first ADR.
- **`component_reuse` never reads back into the Component Reuse Check's own trigger.** That trigger is `components:` plus a scope signal, unchanged and independent of this gate — see the additive relationship stated in `skills/create-issue/SKILL.md`.

Report format — printed once in the pre-flight output, before stage 1, with one line per unconfigured gate:

```
Strategic gates (AGENTS.md strategy.gates) — report only, never a STOP
  component_reuse is on, but AGENTS.md declares no components: block — the
  Component Reuse Check has no registry to check against.
```

Every gate configured, or no gates declared → **print nothing**. An empty report is not printed as "all gates OK": a pre-flight that reports its own silence trains the reader to skip it.

No stage brief changes with the gates. An injected gate AC is an ordinary item of the issue's AC block, so the Tester verifies it and the Critic's `APPROVE — all ACs OK` verdict already covers it.

### Resolved time budgets (pre-flight line)

Pre-flight step 11. **One line, printed before stage 1, on every run** — the two budgets the run will actually be measured against, each with where its value came from:

```
Time budgets — loop wallclock <N> min (AGENTS.md | default), CI poll <M> min (AGENTS.md | default)
```

Append `; <field>: <bad value> ignored, default used` for each field whose declared value was unusable (step 8) — that note is the only thing a malformed budget produces.

**Why this one always prints, when the gates report deliberately does not.** The gates report is a list of *problems*; when there are none it has nothing to say, and printing "all gates OK" would train the reader to skip the pre-flight. This line is not a report of its own silence — it always carries two values, and it is the only place a long run's operator can see, before it matters, which budget will end the run. Do **not** merge it into the gates report: that block's print-nothing-when-clean rule is deliberate and this line would violate it on every run.

### Waiting-on actionability check (pre-flight STOP)

After the AGENTS.md check and **at the same severity tier as a missing AGENTS.md**, inspect the issue's own labels: **any `waiting-on:*` label is a STOP** (no stage 1, no subagent start). A `waiting-on:*` label means the issue is specified but **not actionable** — something or someone still blocks it — and the loop must not start work on a blocked issue.

Resolve the prefix against the repo's `plan-issues.waiting_prefix` (default `waiting-on:` — the check applies even when the repo declares no `plan-issues.goals` vocabulary, because the prefix has a default). Match on the resolved prefix:

```bash
gh issue view <num> --repo <slug> --json labels --jq '.labels[].name | select(startswith("waiting-on:"))'
```

- Any match → **STOP**, naming the label and pointing at where the issue records what it waits on:
  > Issue #<n> carries `<waiting-on:value>` — it is specified but not actionable. See the issue's waiting-on note (the who/what it is blocked on; for a dependency, the blocking issue number). Clear the block and remove the `<waiting-on:value>` label, then re-run `/work-issue <n>`.
- No `waiting-on:*` label → continue. This is the normal state; the check adds no behavior for an unblocked issue (zero behavior change).

The `goal:` axis is **not** gated here — a goal label never blocks a loop; only `waiting-on:` speaks to actionability. Contract for both axes (grammar, the work-list query, the check-question, label retirement): `skills/plan-issues/SKILL.md`, section "Label contract — `goal:` and `waiting-on:` (canonical)".

### Loop-type resolution

Before stage 1, determine the issue loop type. In this order:

1. **Issue label** — `gh issue view <num> --repo <slug> --json labels --jq '.labels[].name'` → look for the `loop-type:<type>` prefix.
2. **Body frontmatter fallback** — if the issue body starts with `---\nloop-type: <type>\n---` → use that value. (Happens when an issue was filed manually without the skill.)
3. **AGENTS.md default fallback** — `loop_types.default` from AGENTS.md (typically `code`).
4. **Last-resort fallback** — `code` (backwards compatibility for issues filed before the multi-type system).

Validation against `loop_types.enabled` from AGENTS.md:
- If the resolved type is **not** in `enabled`: STOP verdict:
  > Issue has `loop-type:<X>`, but AGENTS.md `loop_types.enabled` only contains `<list>`. Please extend AGENTS.md (`/init-agents --refine`) or fix the issue label.

- If the resolved type is `text`/`decision`/`diagnostic` (roadmap types): STOP verdict with roadmap hint:
  > Loop type `<type>` is on the roadmap, not yet implemented. Currently supported: code, research. Track the roadmap in the repo issues with labels `loop-type` + `roadmap`.

On OK: write the resolved type into the state tracker (`loop_type` field). The subagent-brief loader uses this value.

### Model and effort resolution (per stage)

Two axes, **one mechanism**. `models:` picks the alias a stage runs on; `effort:` picks the reasoning-effort level it asks for. They are resolved by the same rules, cached in the same place and recorded on the same audit line. Read every rule below as applying to both unless it names one.

Runs **after** the loop type is resolved (step above) — tier 2 needs `<loop_type>`. Resolve each axis for each stage in this order (right wins, same L1→L2 merge pattern as every other standards value):

1. **Base (L1)** — `work-issue.models.<stage>` / `work-issue.effort.<stage>` from AGENTS.md. Absent key → no override at this layer.
2. **Type layer (L1)** — `loop_types.type_overrides.<loop_type>.models.<stage>` / `...effort.<stage>` from AGENTS.md, for the loop type resolved above. Absent key → no override at this layer.
3. **Issue override (L2)** — a `models.<stage>` or `effort.<stage>` key in the issue's `## Standards Override` block. **Nested under `work-issue:`**, consistent with every other overridable field in that block:
   ```yaml
   work-issue:
     models:
       critic: <alias>          # this one issue needs a specific gate model
       implementer: <alias>
     effort:
       critic: <level>          # this one issue needs a specific gate effort
       implementer: <level>
   ```
   A top-level `models:` or `effort:` in the override block (not nested under `work-issue:`) is **not** read — ignore it with a note in the loop output, do not STOP.
4. **Nothing set at any layer** → inherit the session model; run at the API/session default effort.

The resolved values are the **model alias** and the **effort level** for that stage. An unknown alias (not one of `opus`, `sonnet`, `haiku`, `fable`), an unavailable model, or a rejected model parameter → **fall back to inherit, note it in the stage comment, and continue the loop**. An unknown level (not one of `low`, `medium`, `high`, `xhigh`, `max`), or a model that does not accept the level → **fall back to the default, note it in the stage comment, and continue the loop**. Neither axis may ever break a loop, and the two fall back independently: a rejected level does not disturb an accepted alias. This mirrors the existing graceful-degradation rules for the code-graph MCP and the Playwright MCP: prefer-and-degrade, never hard-fail.

Write the resolved alias (or `inherited`) and the resolved level (or `default`) into the state tracker per stage. The alias is applied at dispatch time; the level is **recorded but not applied** — see "Per-stage model and effort dispatch" under "The 5 stages", which is the one place that states why.

**Recommendation source:** the recommended per-stage mapping — both axes — and the four preset definitions live in
`skills/init-agents/references/model-presets.md`. That file is read by `/init-agents` when
generating a repo's `models:` and `effort:` blocks. `/work-issue` does **not** read it — at loop time the only
source is the target repo's AGENTS.md.

### Subagent-brief loader

For each stage 2 (Implementer), the brief is loaded from `references/subagent-briefs/<loop_type>-implementer.md`. The briefs have placeholders (`{{branch_pattern}}`, `{{syntax_check}}`, etc.) that are replaced at render time. **They are filled from two different source classes:**

1. **Per-repo values** — `{{branch_pattern}}`, `{{commit_identity}}`, `{{git_remote}}`, `{{hard_gates}}` and the rest: from the AGENTS.md cache + state tracker. These vary per repo, which is why they live in the target repo's AGENTS.md.
2. **Plugin-internal text** — `{{git_conventions}}` and `{{delegation_rule}}`: transcluded from text that ships **inside this plugin**, not from the target repo. Both carry rules that are the same in every repo, which is why they live in the plugin. See the next two sections.

| Loop type | Subagent-brief file |
|-----------|---------------------|
| `code` | `references/subagent-briefs/code-implementer.md` |
| `research` | `references/subagent-briefs/research-implementer.md` |

Tester / Critic / Closer stages stay **structurally identical** but check type-specific criteria:
- `code`: build GREEN via `smoke_test`, code-diff quality
- `research`: doc-quality check (test matrix, probe count, working setup or hypothesis roadmap, follow-up spec, sources)

The type-specific check criteria are documented in the corresponding subagent-brief files (sections "Tester check criteria" and "Critic check criteria").

The opt-in **Visual Reviewer** stage (3.5) uses a stage-specific brief, `references/subagent-briefs/visual-reviewer.md` — not an implementer brief. It is loaded only when the `visual:` gate fires (see "Stage 3.5 — Visual Reviewer" below). That stage never commits or pushes, so it carries no `{{git_conventions}}` placeholder. It does carry `{{delegation_rule}}` — spawning is not tied to committing, so that exclusion does not transfer.

### Transcluded git/gh conventions (`{{git_conventions}}`)

`{{git_conventions}}` carries **no per-repo value** — one of two placeholders that do not (the other is `{{delegation_rule}}`, next section). A subagent receives a rendered brief and cannot follow a pointer into another skill mid-run, so the git/gh conventions are **transcluded** into the brief instead of being copied into it. The rules therefore live in exactly one file, and every rendered brief carries the current text by construction — there is nothing to keep in sync.

- **Source:** `skills/github/SKILL.md` — the canonical source for the git/gh interaction conventions (commit identity, `no_unconfigured_coauthors`, read-only `.git` → `gh`, PR-body conventions, the squash-merge caveat, non-interactive shell).
- **Resolution — skill-relative.** Read `../github/SKILL.md`, relative to this skill's own directory (`skills/work-issue/`). This is the repo's existing precedent for reaching another skill's file (the pre-flight reads `../init-agents/references/AGENTS.md.template` the same way). There is **no** `CLAUDE_PLUGIN_ROOT` and **no** plugin-cache path lookup — do not invent one; the plugin's own directory layout is the only thing that has to hold, and it holds identically in a local checkout and in an installed cache.
- **Extent — the delimited block only.** Inject exactly the text between the `<!-- BEGIN git_conventions -->` and `<!-- END git_conventions -->` markers in that file (its §1–§6), verbatim and unabridged, with the two marker lines themselves excluded. **Match each marker only as a whole line** — a line whose entire content, ignoring leading and trailing whitespace, is that marker comment and nothing else. Exactly one line in the file matches each marker (`skills/github/SKILL.md:26` and `:76`); the block is everything strictly between those two lines. **Line-anchoring is not optional:** the canonical file documents its own markers in prose above the block (`skills/github/SKILL.md:19`), and any prose line or code example that reproduces a marker verbatim is matched by an unanchored first-occurrence search — which then extracts a fragment of *that* line instead of the conventions: a short, plausible-looking result that silently replaces every git/gh rule in every rendered brief. **Never** the whole document: its YAML frontmatter is loader metadata, and its "Canonical source" and "See also" sections point back at these briefs — a circular reference inside a rendered brief.
- **Consumers — three, all rendered:** `code-implementer.md`, `research-implementer.md`, and the inline Stage 5 (Closer) briefing in this file. Each carries the placeholder at its commit step; none restates a rule. The Closer's briefing spells it `{{git_conventions}}` too, even though its other placeholders use this file's inline `<...>` style — one placeholder, one name, so a search finds every consumer.
- **Quoting.** Each consumer holds the placeholder on a blockquote line inside its briefing. Re-indent the injected block to that line's quote level so the rendered brief stays one continuous briefing; change no word of the text itself.
- **Failure mode — the loud one and the silent one.** If the file cannot be read, or either marker is matched by anything other than **exactly one** whole line, **STOP before dispatching** and report it. Then check the result as well: ignoring blank lines at its edges, the extracted block must begin with `## 1.` and end with the last bullet of §6. If it does not, the extraction is wrong *even though the markers were found* — treat it exactly like an unreadable marker (STOP and report; never trim, patch or accept it). Never dispatch a brief with an unsubstituted `{{git_conventions}}`, and never fill it from memory — a remembered paraphrase is the copy this mechanism exists to prevent.

Rationale, and why this was chosen over declaring the briefs as copy artifacts: `docs/adr/0012-transcluded-git-conventions.md`.

### Transcluded delegation rule (`{{delegation_rule}}`)

`{{delegation_rule}}` is the second placeholder that carries no per-repo value. Every stage of this loop *is* a subagent, and a subagent can dispatch subagents of its own — so when a nested spawn is warranted, what it inherits, and what the stage must record about it are rules a stage must obey. One rule, one home, transcluded into every briefing that can spawn; no briefing restates a word of it.

- **Source:** the delimited block in **this file**, under "Per-stage model and effort dispatch" → "The delegation rule and the delegation line". That is the only home: `/work-issue` owns both the stages that spawn and the render step that fills the placeholder, so a separate file under `references/` would be a second hop for nothing.
- **Resolution — this file.** No path lookup, no `CLAUDE_PLUGIN_ROOT`, no plugin-cache path. The render step already has this file open.
- **Extent — the delimited block only.** Inject exactly the text between the two `delegation_rule` HTML-comment markers (BEGIN and END) that stand alone on their own lines further down, verbatim and unabridged, with the two marker lines themselves excluded. **Match each marker only as a whole line** — a line whose entire content, ignoring leading and trailing whitespace, is that marker comment and nothing else. Exactly one line in this file matches each marker. **Line-anchoring is not optional, and the decoy hazard is sharper here than for `{{git_conventions}}`:** there the block and the mechanics describing it sit in two different files, here they sit in one, so an unanchored first-occurrence search has this very section to trip over. No line of this section reproduces a full marker comment, deliberately — keep it that way when editing, and never move a marker into prose.
- **Consumers — eight, all rendered:** `code-implementer.md`, `research-implementer.md`, `visual-reviewer.md`, and the five inline stage briefings in this file (Validator, the `code` Tester, the `research` Tester, Critic, Closer). Each holds the placeholder on one blockquote line and carries **no text of its own** — not a summary beside it, not a one-line gloss, not a "see also". The inline briefings spell it `{{delegation_rule}}` even though their other placeholders use this file's `<...>` style, for the same reason `{{git_conventions}}` does: one placeholder, one name, so one search finds every consumer.
- **Quoting.** Re-indent the injected block to the consumer's quote level so the rendered brief stays one continuous briefing; change no word of the text itself. The block holds **no placeholders of its own**, so it makes no difference whether it is injected before or after the per-repo substitution pass.
- **Failure mode.** If either marker is matched by anything other than **exactly one** whole line, **STOP before dispatching** and report it. Never dispatch a brief with an unsubstituted `{{delegation_rule}}`, and never fill it from memory — a remembered paraphrase is the copy this mechanism exists to prevent.

Rationale, the alternatives that were rejected, and why the plugin advises rather than enforces: `docs/adr/0021-delegation-rule-and-spawn-visibility.md`.

## State tracker

**Path — resolved from the environment, not hardcoded.** The state tracker lives at `<temp_dir>/loop-<repo_slug_safe>-<issue>.json`, where `<temp_dir>` is resolved once at pre-flight in this order:

1. `$TMPDIR` if set (macOS / most Unix shells).
2. else `$TEMP` if set (Windows — the native temp dir that both the shell and native tooling agree on; avoid Git-Bash `/tmp`, which is not a native Windows path and is resolved differently by native tools).
3. else the per-OS default: `/tmp` on Linux/macOS, `%TEMP%` (typically `C:\Users\<user>\AppData\Local\Temp`) on Windows.

Write the resolved absolute path into the state tracker itself (`tracker_path`) so every stage reads/writes the same file. On Windows this keeps the tracker on a native path that both the shell and native tooling can open. On Linux/macOS the default resolves to `/tmp`, so existing runs are unchanged.

Example (Linux/macOS default): `/tmp/loop-<repo_slug_safe>-<issue>.json`. Example (Windows): `%TEMP%\loop-<repo_slug_safe>-<issue>.json`.

State-tracker schema:

```json
{
  "issue": 5,
  "repo": "your-org/your-repo",
  "repo_path": "/abs/path/to/local/checkout",
  "tracker_path": "/tmp/loop-your-org_your-repo-5.json",
  "worktree_path": null,
  "claim": { "agent_id": "...", "claimed_at": "ISO", "preclaim_assignees": [] },
  "branch": null,
  "default_branch": "main",
  "pr_base": "main",
  "git_remote": "origin",
  "loop_type": "code",
  "agents_md_loaded": true,
  "standards": { "branch_pattern": "...", "syntax_check": "...", "components": { "registry_path": "...", "code_globs": [...], "usage_policy": "...", "scope": "..." } | null, "visual": { "serve_command": "...", "base_url": "...", "viewports": [...], "routes": [...], "console_error_policy": "...", "scope": "..." } | null, "models": { "validator": "<alias>|null", "implementer": "<alias>|null", "tester": "<alias>|null", "visual": "<alias>|null", "critic": "<alias>|null", "closer": "<alias>|null" } | null, "effort": { "validator": "<level>|null", "implementer": "<level>|null", "tester": "<level>|null", "visual": "<level>|null", "critic": "<level>|null", "closer": "<level>|null" } | null, "wallclock_cap_min": <minutes>, "ci_poll_cap_min": <minutes>, ... },
  "visual_gate": "pending | pass | fail | skipped",
  "started_at": "ISO",
  "iterations": 0,
  "stage": "validator",
  "status": "in_progress",
  "verdicts": {}
}
```

`loop_type` is mandatory — see "Loop-type resolution" above.

`standards.wallclock_cap_min` and `standards.ci_poll_cap_min` are the **resolved** budgets, never `null`: an absent, malformed or non-positive AGENTS.md value is cached as the documented default (see "Hard caps"), so every stage reads a number rather than re-deriving a fallback.

`standards.visual` mirrors the optional AGENTS.md `visual:` block (`null` when absent). `visual_gate` tracks the Visual Reviewer stage outcome (`pending` until stage 3.5 runs; `skipped` when `visual:` is absent, the issue is not frontend-scoped, or the Playwright MCP is missing).

`claim` and `worktree_path` support parallel-safety: `claim` holds the winning `agent_id` + `claimed_at` (ISO) + `preclaim_assignees` (step 1's pre-claim snapshot; step 2.1 keys on it) from the claim protocol (cleared on release); `worktree_path` is the dedicated git worktree stages 2–4 run in (`null` until it is created, cleaned up on merge/abort). See "Claim protocol", "Git worktree isolation" and "Release on failure".

`repo_slug_safe` = `owner_repo` (slash → underscore). Update after every stage.

## The 5 stages

Each stage = its own subagent via the agent tool (`general-purpose`). Sequential; read output, decide on the next stage. A repo with an opt-in `visual:` block adds one conditional stage — **3.5 Visual Reviewer**, between Tester and Critic — for frontend-scoped issues (see "Stage 3.5 — Visual Reviewer" below); it is skipped cleanly otherwise.

Important: **all standards values in the briefings are placeholders** (`<branch_pattern>`, `<syntax_check>`, `<model>`, ...). They are substituted at runtime from the AGENTS.md cache — no more fixed defaults in the skill. **Two placeholders are not standards values**: `{{git_conventions}}` carries the git/gh conventions transcluded from `../github/SKILL.md` inside the plugin, and `{{delegation_rule}}` the nested-spawn rule transcluded from the delimited block in this file — neither is a per-repo value from the cache (see "Transcluded git/gh conventions (`{{git_conventions}}`)" and "Transcluded delegation rule (`{{delegation_rule}}`)"). `<model>` is the alias resolved for that stage and `<effort>` the level resolved for it (see "Model and effort resolution (per stage)"). `<model>` renders as `inherited` when no override applies and as `inherited (<alias> requested, unavailable)` on a fallback; `<effort>` renders as `default` when no override applies and as `default (<level> requested, unavailable)` on a fallback. Every inline stage briefing below carries both so each stage can write its audit line — grammar canonical in "Per-stage model and effort dispatch".

### Per-stage model and effort dispatch

Before dispatching each stage's subagent, resolve the model alias **and** the effort level for that stage using the "Model and effort resolution" logic above. Then:

- **Resolved alias present** — spawn the subagent with the resolved model parameter (`model: <alias>`).
- **No resolved value** (all tiers absent for this stage) — spawn without a model parameter (inherit the session model). Do not hardcode a fallback alias name.
- **Unknown / unavailable / rejected alias** — fall back to inherit (spawn without a model parameter), record the fallback on the audit line, continue the loop. Never STOP.

#### The effort level is resolved and recorded, never dispatched

**This is the canonical statement of the gap; every other live mention in this repo points here.** `docs/adr/0017-per-stage-effort-axis.md` restates it as a dated record of the decision, which is what an ADR is for.

The subagent dispatch this skill uses exposes `description`, `isolation`, `model`, `prompt` and `subagent_type` — and **no effort parameter**. `models:` works because the resolved alias is handed straight to `model:` in the step above; a resolved effort level has nowhere to go. So the `effort:` axis is **declarative in the current harness**: it is parsed, cached, resolved, carried into the briefing as `<effort>` and written onto the audit line as the level that was *requested* — and it does not change how a stage runs.

That is deliberate and it is said out loud rather than implied, because an axis that resolves and then silently does nothing is documentation of an unimplemented feature. Two consequences follow, both binding:

1. **A stage records the effort it requested, never "the effort that ran."** The loop cannot observe what ran. Writing `effort: <level>` on a run where nothing carried that level to the model would be a fabricated audit line — the same class of defect as a Closer reporting a merge SHA it did not read.
2. **A repo that sets `effort:` today buys an intent record, not a behaviour change.** Say so when a user asks; do not present the block as a live cost lever.

**The condition that changes this is narrow and nameable: the dispatch gaining an effort parameter.** When it does, this step passes the resolved level through alongside `model:`, the wording above changes from "requested" to "ran", and *nothing else moves* — not the resolution order, not the cache, not the grammar below. That is why the axis ships on the `models:` rails rather than as a second mechanism. Recorded in `docs/adr/0017-per-stage-effort-axis.md`.

#### Audit-line grammar

Every `[stage:<name>]` comment ends with the audit line, and the audit line is **exactly one** line, in exactly this shape:

```
model: <alias|inherited|inherited (<alias> requested, unavailable)>, effort: <level|default|default (<level> requested, unavailable)>
```

One line, `model` first, comma-space separator, `effort` **always present**. An unset effort renders `default` — never `inherited`: `inherited` is the model vocabulary, and reusing it would blur two different fallbacks. The two axes render independently.

Rendered forms (the alias and level shown are illustrative fillers, not a recommendation — the recommendation lives in `skills/init-agents/references/model-presets.md`, which this skill never reads):

| Situation | Rendered |
|---|---|
| Both resolved and accepted | `model: <alias>, effort: <level>` |
| Neither block set for this stage | `model: inherited, effort: default` |
| Model fell back, effort resolved | `model: inherited (<alias> requested, unavailable), effort: <level>` |
| Model resolved, effort rejected | `model: <alias>, effort: default (<level> requested, unavailable)` |
| Both fell back | `model: inherited (<alias> requested, unavailable), effort: default (<level> requested, unavailable)` |

The `<model>` and `<effort>` placeholders in every stage briefing are substituted with the already-rendered halves, so a stage writes the line without re-deriving it.

#### The delegation rule and the delegation line

Every stage of this loop is itself a subagent, and it may dispatch subagents of its own. When that is worth doing, what a nested spawn inherits on each axis, and what the stage may honestly record about it are **one rule with one home** — the delimited block below, which the render step transcludes into every briefing that can spawn (mechanics: "Transcluded delegation rule (`{{delegation_rule}}`)"). Nothing else in this plugin states the rule, and no brief restates it.

**The delegation line is a second, conditional line — it does not extend the audit line.** A stage that dispatched subagents writes it immediately *above* the audit line, so the audit line stays last in every comment, with its grammar and its five rendered forms unchanged. A stage that dispatched none writes nothing at all — the silent-when-empty posture the `strategy.gates` consistency report already uses. The delegation line's grammar is stated once, inside the block.

**What a stage may write is bounded by what it can observe** — the same rule the effort axis follows above. A stage issues its own dispatches, so how many children it dispatched and which model alias it passed them are first-hand facts. The model a child actually resolved to is not exposed to the stage, and a grandchild is invisible to it altogether; writing either would be a fabricated record, the defect the requested-never-ran vocabulary exists to prevent.

**The plugin advises and records. It does not cap.** A skill is text and cannot limit spawning; the only documented caps are environment variables the operator sets, named in `CLAUDE.md`. Nothing below claims otherwise.

<!-- BEGIN delegation_rule -->
**Nested subagents — when to spawn one, what it inherits, and what you record.**

You may dispatch subagents of your own. Decide before you do, because delegating is not free:

- **Warranted:** a genuinely independent, sizeable track of work — a wide multi-file investigation, one probe per test-matrix cell, one sweep per route × viewport — where the children do not depend on each other's results and each has real work to do. Independence **and** size, both at once.
- **Not warranted:** anything you could finish yourself in a handful of tool calls. A child costs a full context load and a round trip, so small work is more expensive delegated than done.
- **Never to check your own work.** This loop already verifies you twice, from fresh context: the Tester against the ACs and the Critic against the diff. Fanning out because you feel uncertain buys a second opinion the loop was going to get anyway, and pays for it twice.

**Nothing is inherited, and the two axes fail differently — so pass explicitly whatever a child needs:**

- **Model** — a real dispatch parameter that is **not propagated**. A child you spawn without one falls back to the session model, not to yours. Pass your stage's resolved alias (the `model:` half of your audit line) explicitly when the child's work needs the same model.
- **Effort** — **not a dispatch parameter at all** in the current harness. There is nothing to inherit and nothing to hand down: the `effort:` half of your audit line records what was requested for *you*, and it is not a value you can pass on.

**Record what you dispatched — and only that.** If, and only if, you dispatched at least one subagent yourself, write **one** line immediately **above** your audit line, so the audit line stays last:

```
delegation: <n> dispatched, model passed: <alias|none>
```

- `<n>` counts the subagents **you dispatched directly**. It is **not a total**: a child that spawns its own children is invisible to you. Never present the number as a total and never call it "nested agents used".
- `model passed:` names the alias **you passed** them, or `none` when you passed no model parameter. Different aliases to different children → list them comma-separated, in dispatch order.
- **Never name the model a child ran on.** A child's resolved model is not exposed to you, so writing one would be a fabricated audit record — the same defect as claiming an effort level that nothing carried.

**Dispatched nothing? Write no delegation line at all** — not `delegation: 0`, not "no subagents spawned". Silence is the correct rendering.
<!-- END delegation_rule -->

### Stage 1 — Spec Validator

**Briefing (template):**
> You are validating issue #N in repo `<slug>`. You build nothing.
>
> Standards context: the repo has an AGENTS.md with `hard_gates: <hard_gates>` and `ac_templates: <ac_templates>`. AGENTS.md body:
> ```
> <AGENTS-MD-BODY>
> ```
>
> {{delegation_rule}}
>
> 1. Read `gh issue view N --repo <slug>`.
> 2. Validator gates:
>    - [ ] **ACs are testable (every checkbox concretely verifiable) and each AC names its observable** — what will be looked at to decide it: a command's output, a file at a path, an HTTP status, a log line, a rendered screenshot. A checkbox whose only conceivable proof is "the Implementer states it is done" is a STOP that quotes the offending checkbox verbatim, never a category, and proposes a concrete rewrite:
>      - STOP + "AC `<checkbox>` names no observable. Rewrite it so it names what proves it, e.g. `<concrete rewrite>`." — worked example: STOP + "AC `- [ ] error handling improved` names no observable. Rewrite it so it names what proves it, e.g. `- [ ] a request with a malformed body returns 400 and logs "invalid payload" (visible in <command> output)`."
>    - [ ] ACs include the `ac_templates` from AGENTS.md
>    - [ ] Files-to-touch exist or are described as new. Check via `get_architecture` from codebase-memory + `ls` in the repo path.
>    - [ ] Dependencies satisfied (`depends on #X` → check `#X` is CLOSED)
>    - [ ] **Test plan present, and names the execution path per new or changed test.** For every test the issue proposes to add or change, exactly one of three legal forms, all explicit:
>      - `run by <smoke_test command> locally and in CI job <name>`
>      - `run by <command> locally only — not executed in CI` — **legal**: this is the statement that makes the gap visible instead of leaving it to be discovered after a merge
>      - `not executed automatically — manual verification, steps below` — the steps are mandatory; this form with no steps is a STOP
>      - Missing an execution path entirely → STOP + "Test Plan for `<test>` names no execution path. State one of: `run by <smoke_test command> locally and in CI job <name>`, `run by <command> locally only — not executed in CI`, or `not executed automatically — manual verification, steps below`."
>      - **Degradation.** Where the repo's `smoke_test` resolves to a no-op (`true`, `:`, or the empty string), the gate requires the *statement*, not a command — "structural inspection only" is an acceptable execution path, so the gate never becomes unsatisfiable for a documentation repo.
>      - The `research` loop type keeps its own doc-quality checklist unchanged; this form applies to it only where the findings doc proposes an executable probe.
>    - [ ] Out-of-scope named (at minimum `default_oos` from AGENTS.md plus issue-specific)
>    - [ ] `hard_gates` from AGENTS.md addressed
>    - [ ] **Component-Registry gate (only if AGENTS.md `components:` is set AND the issue's Spec or Files-to-Touch overlaps `code_globs` — optionally filtered by `scope`):** the issue names an existing registry component (from `registry_path`) OR links an ADR path in the `## Standards Override` block that justifies adding a new one.
>      - Under `usage_policy: strict` — missing → STOP + "Add an ADR at `docs/adr/<n>-<slug>.md` and link it in `## Standards Override`, or reference the existing registry component."
>      - Under `usage_policy: prefer_existing` — missing → WARN (not STOP); post the warning in the Validator comment; the loop continues.
>      - Absent `components:` block OR issue outside `code_globs` scope → gate skipped silently.
> 3. On STOP: concrete spec-improvement suggestions.
> 4. Output: comment `## [stage:validator] <GO|STOP>` on the issue + a parent report carrying the verdict, the gate table's outcome and, on STOP, the failing gates with the step-3 spec-improvement suggestions (length: see "Issue-comment convention"). End the comment with the `model: <model>, effort: <effort>` audit line — one line, both halves always present, grammar canonical in "Per-stage model and effort dispatch". `<effort>` is the level **requested** for this stage, not a claim about what ran.

**Parent decision:**
- STOP → **release the claim + run the terminal cleanup** (see "Release on failure"), loop paused, a message to the user with reasons + suggestion `/create-issue --refine <num>`.
- GO → stage 2.

### Stage 2 — Implementer (type dispatch)

**Brief selection by loop type:**

| `loop_type` from pre-flight | Brief file |
|-----------------------------|------------|
| `code` (default) | `references/subagent-briefs/code-implementer.md` |
| `research` | `references/subagent-briefs/research-implementer.md` |

The skill loads the matching brief file, replaces the per-repo placeholders (`{{branch_pattern}}`, `{{syntax_check}}`, `{{hard_gates}}`, `{{secret_scan_pattern}}`, `{{issue_num}}`, `{{repo_path}}`, `{{worktree_path}}`, `{{slug}}`, `{{pr_base}}`, `{{commit_format}}`, `{{commit_identity}}`, `{{git_remote}}`, `{{model}}`, `{{effort}}`) from the AGENTS.md cache + state tracker, replaces **`{{git_conventions}}`** from the plugin-internal canonical file (`../github/SKILL.md`, delimited block only — see "Transcluded git/gh conventions (`{{git_conventions}}`)") and **`{{delegation_rule}}`** from the delimited block in this file (see "Transcluded delegation rule (`{{delegation_rule}}`)"), and dispatches the result as the subagent briefing. `{{commit_identity}}` is `null` when the optional `commit_identity:` block is absent from AGENTS.md. `{{model}}` is the model alias resolved for this stage (or `inherited`) and `{{effort}}` the level resolved for it (or `default`); together they form the stage's audit line. `{{git_remote}}` is the registry `git_remote` field for the repo; it falls back to `origin` when the registry does not declare one (zero behavior change for existing setups), and is used for every push, PR create, and branch cleanup in the Implementer and Closer.

**Git worktree isolation (parallel-safety):** so concurrent runs on the same repo never fight over the primary `repo_path` checkout, the branch is created in a **dedicated git worktree** instead of mutating `repo_path` in place. Before dispatching the Implementer brief:

```bash
git -C <repo_path> worktree add <tmp-dir>/<slug-safe>-<issue> -b <branch> <pr_base>
```

Write the resulting path into the state tracker as `worktree_path` and pass it to every stage-2–4 brief as `{{worktree_path}}`. **Stages 2–4 (Implementer, Tester, Critic, and the optional Visual Reviewer) operate inside that worktree**, not in `repo_path`, using it as the working directory. The branch is **already checked out** in the worktree by the `worktree add` above, so **no stage re-runs `git checkout <branch>`** — inside the worktree that is at best a no-op, and git refuses it outright when the branch is checked out here; it must never be treated as a failure. **Every `git diff` in those stages uses `pr_base` as the base** — the same base the worktree was cut from — so worktree creation, implementation, test and review all compare against one base.

**Branch reuse on takeover.** Before cutting a fresh branch, check whether `<branch>` already exists on `<git_remote>`: `git -C <repo_path> ls-remote --heads <git_remote> <branch>`. This is non-empty chiefly after a takeover (see "Claim protocol", the staleness filter) — the dead run pushed commits before it died. When it is non-empty, track the existing branch instead of starting over:

```bash
git -C <repo_path> worktree add -B <branch> <tmp-dir>/<slug-safe>-<issue> <git_remote>/<branch>
```

— the same idiom the evidence-gate re-entry already uses to resume a branch (see "Pre-Flight stage 0", step 4). When the `ls-remote` is empty, cut fresh from `<pr_base>` as in the command above. This is what keeps a takeover from producing a second branch for the same issue (no `-2` suffix) and from silently discarding the dead run's already-pushed commits.

**Cleanup — worktree, then local branch (canonical rule).** On the **Closer's terminal verdict** (`merged`, or `ESCALATE: CI pending` with the PR left open) OR on **abort / ESCALATE / STOP / hard-cap**, remove the worktree and then delete the local branch:

```bash
git -C <repo_path> worktree remove <worktree_path> --force
git -C <repo_path> branch -D <branch>        # local ref only — the remote branch is never touched here
```

**This block is the single source for terminal cleanup.** It is identical on every terminal path, so the Closer's step 9 and "Release on failure" step 2 point here rather than restating it — the same way the uniform claim rule is stated once in "Closer merge behavior". It covers the worktree and the branch **this run created**; a run that created neither (the open-PR resume in Pre-Flight step 4, on its tag-absent path) has nothing of its own to clean up and skips the step — the evidence-gate re-entry on that same step 4 does create both and is cleaned up right here, like any other run that created a worktree. Both commands are cleanup and **never a blocker for the terminal verdict**: whatever they report, the loop still reaches `merged` / `stopped` / `escalated` / `aborted`.

**Why the branch delete is needed at all — `--delete-branch` is remote-only.** `gh pr merge --delete-branch` (the Closer's squash-merge) deletes the branch **on the remote**. The merge runs through the GitHub API and never touches local refs, so without the explicit `branch -D` the local branch in `repo_path` survives the worktree removal on every terminal path. That surviving ref is not untidiness: with a `branch_pattern` that carries the issue number, a retry of the same issue recreates the same branch name and fails at worktree creation with `fatal: a branch named '<branch>' already exists`.

**An already-absent branch is not an error.** `git branch -D` exits non-zero with `error: branch '<branch>' not found` when the ref is already gone. That is the expected second outcome, not a failure: report `branch: already absent`, continue, never STOP, never downgrade the terminal verdict.

**A branch still held by a leftover worktree is the third outcome.** If the worktree removal failed and its directory survives, git refuses the delete with `error: branch '<branch>' is used by worktree at '<path>'`. Report that as `branch: still checked out in leftover worktree <path>` — never as `already absent`, which would claim the ref is gone when it is not. Like the other two, it is not a failure and never downgrades the terminal verdict; the leftover directory is already being reported to the user alongside it.

**Remote branches stay out of this rule.** `branch -D` deletes the local ref and nothing else. On a successful merge the remote branch is already gone (the squash-merge's `--delete-branch` took it). On an `ESCALATE: CI pending` exit the remote branch **survives on purpose** — the open-PR resume merges from the remote and deletes it there — and deleting the local ref does not disturb that: the Implementer already pushed to `<git_remote>`, the resume works from the remote refs, and a local `branch -D` leaves the remote-tracking ref intact. Never add a remote delete to this rule.

**Reporting.** Both results are recorded wherever the terminal outcome is recorded today — `worktree: removed` or the leftover path, plus `branch: deleted` or `branch: already absent`. Concretely: the Closer stage comment on either terminal verdict (step 10 on `merged`, the `ESCALATE: CI pending` comment) and the `## [claim:released]` note on a release-on-failure exit. Without the branch line a later reader cannot tell whether the ref is gone or whether the step was skipped.

**Do not conflate this with the non-fatal fallback below.** The rule above is the cleanup for the **normal** case — `git worktree remove` succeeded. The "Non-fatal cleanup fallback" immediately below applies **only when `git worktree remove` failed**; it is a recovery route, not a competing cleanup rule. Its own `branch -D` line reaches the same local-ref deletion by that other route. If that delete succeeded, this rule's delete finds the branch gone and reports `already absent`. If it did not — `git worktree prune` is a no-op while the leftover directory still holds a valid gitdir, which is the common shape of the failure — the ref is still held by that worktree, and the honest report is the third outcome above, not `already absent`.

**Non-fatal cleanup fallback (worktree-removal failure).** `git worktree remove` can fail — typically with "Filename too long" or "Directory not empty" when the worktree contains a `node_modules` tree, reproducible even with `core.longpaths=true` and a deliberately short worktree path. This must **never** abort the loop or block a terminal verdict. On removal failure, run the documented non-fatal fallback:

1. **Clean the git side** so git no longer tracks the worktree:
   ```bash
   git -C <repo_path> worktree prune            # drop the stale worktree registration
   git -C <repo_path> branch -D <branch>        # delete the local branch (if it still exists)
   ```
2. **Report the leftover directory to the user** for manual removal (name the exact path in the parent report and, on a channel run, in the channel message).
3. **Continue to the terminal verdict** — the loop still reaches `merged` / `stopped` / `escalated` / `aborted`. A leftover directory is a reported side effect, not a failure.

**Never** prescribe a recursive force-delete (e.g. `rm -rf` / `rmdir /s`) as the cleanup fallback: while other loops run against the same repo, a recursive delete can destroy state another run depends on. The prescribed fallback is git-side pruning plus a manual-removal report — nothing more.

**Git/gh conventions (all commits and pushes in stage 2 and stage 5):** commit author identity, the `no_unconfigured_coauthors` rule, the squash-merge co-author caveat, PR-body conventions, the read-only-`.git` fallback and the non-interactive-shell rules are **canonical in `skills/github/SKILL.md`** and restated nowhere except the one declared copy in `skills/init-agents/references/AGENTS.md.template`. Both stages receive them in full: their briefs carry the `{{git_conventions}}` placeholder, which the render step fills from that file (see "Transcluded git/gh conventions (`{{git_conventions}}`)").

**Default `secret_scan_pattern`** (when not set via issue override):
```
(ghp_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{40,}|TELEGRAM_BOT_TOKEN=[0-9]+:[A-Za-z0-9_-]+|API_KEY=[a-zA-Z0-9]{20,})
```

**Parent decision:** spec gap too large → ESCALATE. Otherwise stage 3 (or skip rule).

### Stage 3 — Tester (type-specific check criteria)

**Briefing schema (`loop_type: code`):**
> You verify the ACs from issue #N. You do not write code.
>
> Standards: `smoke_test: <smoke_test>` from AGENTS.md (plain string OR scope mapping — see "Scope-aware smoke_test").
>
> {{delegation_rule}}
>
> 1. Operate inside the worktree — your branch is already checked out there (no `git checkout`; see "Git worktree isolation").
> 2. **Resolve the smoke command for this diff:**
>    - **Plain-string `smoke_test`:** use it verbatim (unchanged behaviour).
>    - **Scope-mapping `smoke_test`:** compute the diff paths (`git diff --name-only <pr_base>..<branch>`), match them against `components.code_globs` (or the mapping's own `scopes:` globs when `components:` is absent), and select the command(s) for the matched scope(s). No scope matched, or the matched command is the empty string → **skip** the smoke test with the reason "smoke test not applicable to this diff scope" (name the resolved scope in the comment).
>    - **`parallel_safe: false` AND another active claim exists on the repo** (detect via the claim protocol — any other `claimed:*` label / non-retired `## [claim]` comment with another agent-id; the assignee is advisory and never a claim signal, see "Claim protocol"): **skip** the smoke test with the reason "smoke test not parallel-safe; a concurrent claim is active" (name the competing claim in the comment). Never run a non-parallel-safe smoke test while another loop is active.
> 3. Run the resolved smoke command (or record the skip reason from step 2).
> 4. **Execution evidence.** The full procedure — applicability, the base run, the revert check, the fail conditions and the evidence-block schema — is canonical in "Execution evidence" above; read it there and apply it, do not reconstruct it from this line. Produce the base run and, where in scope, the revert check when §1 there resolves `applicable: true` for this diff; where it resolves `applicable: false`, record that state instead and skip both. Post the resulting fenced `evidence:` block in this stage's comment, after the per-AC section.
> 5. Per AC checkbox: smoke test + proof (log snippet, command output). For a skipped smoke test, verify the ACs by the other available evidence and state that the smoke step was skipped.
> 6. **Cleanup requirement:** reset live stack/state if touched. Cleanup status in the comment.
> 7. **Regenerate derived documentation** — `docs_command: <docs_command>` from AGENTS.md. Empty string **or absent field** → skip, and **say which of the two it was**: `docs_command: ""` (declared not applicable) or `docs_command: not declared in AGENTS.md`. The distinction is the whole point — a declared empty is a decision, an absent field is a gap nobody has looked at.
>    - Run it, then `git status --porcelain` on the paths it writes.
>    - Changed → commit that change onto the branch (docs-only commit, nothing else staged) so the regenerated output is part of **this** changeset and the Critic reviews it.
>    - Unchanged → no commit. Say "derived docs unchanged" — that is a result, not a non-event: it means the change did not move what the docs describe.
>    - **The command failing is a FAIL**, not a skip. A generator that cannot run produces a valid-looking, incomplete file; treating its failure as "nothing to do" is how an incomplete artefact reaches review looking finished.
> 8. Issue comment `## [stage:tester] <PASS|FAIL>` with per-AC status + proof + (if applicable) the smoke-skip reason + the `evidence:` block (step 4) + the derived-docs result + cleanup status. End the comment with the `model: <model>, effort: <effort>` audit line — one line, both halves always present, grammar canonical in "Per-stage model and effort dispatch". `<effort>` is the level **requested** for this stage, not a claim about what ran.
>
> Parent output: the PASS/FAIL verdict, the per-AC status with the proof that decided each one, the resolved smoke command (or the skip reason), the execution-evidence verdict, the derived-docs result and the cleanup status (length: see "Issue-comment convention").

**Briefing schema (`loop_type: research`):**
> You verify the findings doc quality from issue #N. You do **not** run `smoke_test`.
>
> {{delegation_rule}}
>
> 0. **Execution evidence resolves `applicable: false`** for this loop type — see "Execution evidence" §1. No base run, no revert check; record §1's reason for this loop type (named once there, not repeated here) and continue to the doc-quality check below, unchanged.
> 1. Operate inside the worktree — your branch is already checked out there (no `git checkout`; see "Git worktree isolation"). Find the doc (`docs/research/<topic>-<date>.md`).
> 2. **Doc-quality check** against the issue ACs and the type-check list in
>    `references/subagent-briefs/research-implementer.md` section
>    "Tester check criteria":
>    - [ ] Test-matrix table present
>    - [ ] >= 6 probes documented
>    - [ ] Working-setup section OR hypothesis-roadmap section
>    - [ ] Follow-up implementation-issue spec attached
>    - [ ] Sources list with >= 1 link
>    - [ ] No secrets in the doc (pattern scan)
> 3. Issue comment `## [stage:tester] <PASS|FAIL>` with per-check-item status + doc quote as evidence. End the comment with the `model: <model>, effort: <effort>` audit line — one line, both halves always present, grammar canonical in "Per-stage model and effort dispatch". `<effort>` is the level **requested** for this stage, not a claim about what ran.
>
> Parent output: the PASS/FAIL verdict and the per-check-item status, each with the doc quote that decided it — and on FAIL, which item failed (length: see "Issue-comment convention").

**Skip rules:**
- **`code` loop — docs-only:** diff only in `docs/**` OR `**.md` OR `// comment`-only → skip the whole Tester stage, go directly to Critic. Mark `skip_tester_round_N: docs_only` in the state.
- **`code` loop — smoke not applicable to this diff scope:** with a scope-mapping `smoke_test`, when the diff matches no named scope (or the matched scope's command is empty), the Tester still runs the AC verification but **skips the smoke command** with the reason "smoke test not applicable to this diff scope". Mark `skip_smoke_round_N: scope_not_applicable` in the state. The Tester names the resolved scope in its comment.
- **`code` loop — smoke not parallel-safe:** with `parallel_safe: false` and another active claim on the repo, the Tester skips the smoke command with the reason "smoke test not parallel-safe; concurrent claim active". Mark `skip_smoke_round_N: parallel_unsafe` in the state and name the competing claim in the comment.
- **`research` loop:** skip rule **disabled** — doc-quality check is mandatory (otherwise not verifiable).

The `skip_smoke_round_N` identifiers named above (`scope_not_applicable`, `parallel_unsafe`) are exactly the plugin-applied entries "Execution evidence" §2 feeds into its base-vs-branch skip **set**, alongside the code-graph pre-flight's three degradation states. `skip_tester_round_N: docs_only` is not one of them: it records that the whole Tester stage — this procedure included — never ran for the round (see "Execution evidence", "Docs-only bypass"), so there is no run for it to be a skip *within*.

**Parent decision:** FAIL → stage 4 (Critic decides revise or escalate). PASS → stage 4. (One narrow, named exception: the Pre-Flight open-PR check's evidence-gate re-entry overrides the PASS branch — see "Pre-Flight stage 0".)

### Stage 3.5 — Visual Reviewer (opt-in `visual:` gate)

**Runs only when both hold** (otherwise skipped silently, `visual_gate: skipped`):
1. AGENTS.md carries a `visual:` block (cached at pre-flight, see the optional-field parse below), and
2. the issue is **frontend-scoped** — files-to-touch match a frontend glob (e.g. `**/*.tsx`, `**/*.vue`, `**/*.svelte`, `src/pages/**`, `src/components/**`) OR the Spec/AC contain a frontend keyword (`page`, `route`, `UI`, `component`, `layout`, `responsive`, `screen`, `viewport`).

Sits **between Tester (build green) and Critic** — the browser only spins up once the build is green.

**Brief:** `references/subagent-briefs/visual-reviewer.md`. Placeholders (`{{serve_command}}`, `{{base_url}}`, `{{viewports}}`, `{{routes}}`, `{{console_error_policy}}`, `{{branch}}`, `{{issue_num}}`, `{{slug}}`, `{{repo_path}}`, `{{worktree_path}}`, `{{model}}`, `{{effort}}`) are substituted from the `visual:` cache + state tracker, and **`{{delegation_rule}}` is transcluded from the canonical block in this file** — the same mechanism the Implementer briefs use, and subject to the same rule: never dispatch a brief with it unsubstituted. `{{model}}` is the alias resolved for this stage (or `inherited`) and `{{effort}}` the level resolved for it (or `default`); neither ever affects whether the stage fires.

**Flow:** serve the built frontend (`serve_command`, wait for `base_url`) → per route × viewport (mobile first): `mcp__playwright__browser_resize` → `browser_navigate` → `browser_snapshot` + `browser_take_screenshot` + `browser_console_messages` → evaluate the issue's Visual Acceptance ACs → tear down → issue comment `## [stage:visual] <PASS|FAIL>` with screenshots attached + per-AC verdict.

**Dependency:** the Playwright companion MCP (`mcp__playwright__*`). Absent namespace → skip with `## [stage:visual] SKIPPED (no playwright MCP)`, `visual_gate: skipped`, continue to Critic. Never a hard fail.

**Parent decision:**
- PASS (`visual_gate: pass`) → stage 4.
- FAIL (`visual_gate: fail`) → `iterations++`, back to stage 2 (Implementer) with the visual defect list as the briefing. **Shares the 3-revise hard cap** with Critic REVISE (a visual FAIL and a Critic REVISE count against the same cap).
- SKIPPED → stage 4.

### Stage 4 — Critic

**Briefing (template):**
> You review branch `<branch>` (HEAD `<commit>`) against issue #N.
>
> Standards context: AGENTS.md body + `hard_gates: <hard_gates>`.
>
> {{delegation_rule}}
>
> 1. Read the issue ACs + Implementer comment + Tester comment.
> 2. Read `git diff <pr_base>..<branch>` (same base the worktree was cut from).
> 3. Per AC: `search_code` via codebase-memory for code evidence ("AC says X, code snippet shows Y") → OK/Warn/Fail.
> 4. Evaluate Tester findings: blocking or documentable? **Including the execution-evidence block (see "Execution evidence" §4):** on an issue labelled `bug`, an `evidence.revert_check` value of `n/a — diff adds no tests` is not itself a Tester FAIL, but raise it here as a named, non-blocking finding — a bug fix with no regression test is worth flagging even where nothing blocks it.
> 5. Out-of-scope check (`<default_oos>` + issue OoS).
> 6. **Out-of-diff falsification check (runs on every Critic run — full procedure in "Out-of-diff falsification check" below):** answer this question explicitly in the stage comment: *"Does this diff change a **default**, a **terminal verdict**, the **semantics of a declared field**, or a **documented behaviour**?"* — those four triggers, enumerated, are (1) a changed default, (2) a changed terminal verdict, (3) changed semantics of a declared field, (4) a changed documented behaviour. **`no`** → write the line `out-of-diff check: n/a (no behaviour or default changed)` in the stage comment and go to step 7; the search never runs. That line is written on **every** run whose answer is `no` — a silent omission is not an acceptable rendering, because it is what lets a later reader tell the check ran rather than was forgotten. **`yes`** → run the search below and list every hit with its classification (an empty hit list is stated as empty, not omitted). A **falsified** hit is a REVISE item under the existing 3-revise cap; this step adds no terminal verdict.
> 7. `hard_gates` check (see AGENTS.md).
> 8. Code quality (smoke): naming, error handling, cleanup, security.
> 9. **Component-Registry dupe-detection (only if AGENTS.md `components:` is set):** `search_code` / grep across `<code_globs>` for patterns similar to what this diff introduces (e.g. the diff added a new table-like component — grep the frontend globs for other table-like components; the diff added a monetary VO — grep the backend globs for other monetary handling). If two implementations cover the same concept: raise a REVISE item with both code paths, quoting a snippet from each, and propose either (a) consolidate into the existing registry component or (b) file an ADR that justifies the parallel implementation. This step runs regardless of `usage_policy` — under `prefer_existing` the Critic can still catch a dupe that slipped past the Validator warning.
>
> Verdict:
> - **APPROVE** — all ACs OK, no blocking findings, OoS + hard_gates respected.
> - **REVISE** — actionable items (concrete).
> - **ESCALATE** — spec gap / architectural question.
>
> Issue comment `## [stage:critic] <verdict>` with AC review + OoS check + findings evaluation + (on REVISE) actionable items. End the comment with the `model: <model>, effort: <effort>` audit line — one line, both halves always present, grammar canonical in "Per-stage model and effort dispatch". `<effort>` is the level **requested** for this stage, not a claim about what ran.
>
> Parent output: the verdict (APPROVE / REVISE / ESCALATE), the per-AC review with its evidence, the out-of-diff check's answer and, on REVISE, the actionable items (length: see "Issue-comment convention").

**Parent decision:**
- APPROVE → stage 5.
- REVISE → `iterations++`, stage 2 again with the Critic comment as the briefing. **Hard cap: 3 revises** (on hitting the cap: release the claim + run the terminal cleanup, see "Release on failure").
- ESCALATE → **release the claim + run the terminal cleanup** (see "Release on failure"), pause, a message to the user.

#### Out-of-diff falsification check

**This section is the single canonical statement of the check.** Stage 4 step 6 runs it; the per-loop-type Critic criteria in both subagent briefs point here and restate none of it. Design rationale — why a classification gate, why the path-field exclusion, why no new terminal verdict — in `docs/adr/0011-out-of-diff-falsification-check.md`.

The Critic reads the diff, and only the diff. A change to a default or to a documented behaviour, however, falsifies sentences that live **outside** it — in `README.md`, in `CLAUDE.md`, in an AGENTS.md body, in another skill — and no other stage looks at them. Those sentences survive into the default branch as documentation of behaviour that no longer exists. This step is the pass that catches them.

##### §1 — Classify the diff

The classification question and its four triggers are stated verbatim in **stage 4 step 6** above — the text the Critic is briefed with — and are not repeated here. What each trigger means:

1. **a default** — any value the loop resolves to when nothing is set (including what an *absent* field resolves to);
2. **a terminal verdict** — any verdict string a stage can exit with, or the set of them;
3. **the semantics of a declared field** — what an existing AGENTS.md key, frontmatter key or label means, its permitted values, or what its absence means;
4. **a documented behaviour** — anything a file in the repo describes as what the loop, a skill or a stage does.

- **`no`** → write `out-of-diff check: n/a (no behaviour or default changed)` in the stage comment and continue with the next step. **§2 does not run.** This is the constraint that keeps the check from becoming an unconditional repo-wide grep on every loop: a pure feature addition, a wording fix or a typo diff never reaches §2. The `n/a` line is still written, every time — the check is cheap to *record* and that record is what distinguishes "ran, found nothing to do" from "was forgotten".
- **`yes`** → run §2.

##### §2 — Search for descriptions of the old behaviour outside the diff

**Terms.** Derive them from the diff itself and write them to `<temp_dir>/ood-terms-<repo_slug_safe>-<issue>`, one per line, **deduplicated and non-empty** — an empty line is an empty `-F` pattern and matches every line in the repo.

**Both temp files are per-run, never shared.** They follow the state-tracker path convention exactly (see "State tracker"): the same `<temp_dir>`, resolved once at pre-flight from `$TMPDIR` → `$TEMP` → the per-OS default, and the same `<repo_slug_safe>-<issue>` disambiguation. `/work-issue` is parallel-safe, so a fixed shared filename would let two concurrent Critics clobber each other's files and filter one run's hits against the other run's changed paths — silently, exit code 0, which is the same silent-wrong-filter failure this whole check exists to catch.

A string **qualifies as a term** when it is identifier-like, or a quoted multi-word string, and the diff changed it: a changed field name (`merge_policy`), a verdict string (`ready-for-close-out`), a command or skill name (`/close-out`), a flag name (`--wave`), a named default value (`prefer_existing`), a label grammar (`wave:<n>`), or the title of a section the diff renamed or deleted (`"Merge policy"`).

A string is **excluded** when it is a bare English word, a bare boolean or bare number (`true`, `defer`, `3`, `auto`), or anything else generic enough to match most of the repo — those bury the real hits rather than finding them. A term whose hit count is unreadable is **narrowed**, never dropped silently: qualify it, pair it with its namespace (`merge_policy:` rather than `policy`), and say in the stage comment which term was narrowed and to what.

**Command.**

```bash
git -C <worktree_path> diff --name-only <pr_base>..<branch> > <temp_dir>/ood-paths-<repo_slug_safe>-<issue>
grep -rn -F -f <temp_dir>/ood-terms-<repo_slug_safe>-<issue> . --include='*.md' \
  | awk -F: 'NR==FNR { skip[$0]; next }
             { p = $1; sub(/^\.\//, "", p); if (!(p in skip)) print }' <temp_dir>/ood-paths-<repo_slug_safe>-<issue> -
```

The `awk` filter excludes a hit by **the path it was found in** — field `$1` of the grep output, with a leading `./` stripped so both `grep -r .` output conventions compare equal — and **never** by the text of the matched line.

That distinction is the whole point of the step. Filtering the full line (`grep -v -F -f <temp_dir>/ood-paths-<repo_slug_safe>-<issue>`) drops every sentence that *cites* a changed file, and a pointer sentence naming a changed file is precisely the sentence a behaviour change falsifies. It drops them with no trace, so the check would report a clean run over the hits it exists to find. Line-filtering also over-matches by prefix — `README.md` in the list suppresses `docs/README.md`; the path-field comparison is exact.

Degenerate cases, all benign and none an error: an empty `ood-terms-…` file → the hit list is empty, and is reported as empty; paths the diff **deleted** sit in `ood-paths-…` and match nothing; a repo whose only `*.md` files are all in the diff → empty hit list.

##### §3 — Classify every hit

Each hit is exactly one of three:

- **still true** — the statement survives the change unchanged.
- **falsified** — the statement describes behaviour that no longer exists → **REVISE item**, quoting the file, the line number and the sentence.
- **historically fenced** — the hit sits **inside** an ADR under `docs/adr/`, or another dated record whose scope is explicitly the state at decision time. The fence test is **file-level, not sentence-level**: being inside such a file *is* the fence, and no per-sentence disclaimer is required within it (`docs/adr/0004` is fenced by ADR 0007's "left in place as historical records" even though nothing inside `0004` says so). A hit that **claims** the fence from outside such a file — a live standards file describing a decision as historical — is **falsified**, not fenced.

The Critic lists every hit and its classification in the stage comment. **An empty hit list is stated as empty, not omitted.**

##### What this step is not

- **Not a new terminal verdict.** A falsified statement is a REVISE item under the existing 3-revise cap, nothing more. The Critic's verdict set (`APPROVE` / `REVISE` / `ESCALATE`) and the cap are unchanged.
- **Not a second whole-repo grep on every loop.** §2 runs only after a `yes` in §1, over `*.md` prose, with terms drawn from the diff.
- **Not the Component-Registry dupe-detection pass, and not a duplicate of it.** They are siblings: that pass greps `<code_globs>` for *code* that duplicates what the diff introduced; this one greps Markdown for *prose* that the diff falsified. Different inputs, different globs, different finding, different remedy.
- **Not the repair.** The Critic reports the falsified statements; the Implementer patches them on the revise pass.

### Stage 5 — Closer (type routing)

The Closer runs the full briefing below, steps 0–11 plus 3a: git/gh conventions (transcluded), PR create, CI base-vs-PR baseline, bounded CI polling (with the `ESCALATE: CI pending` exit — which releases the claim, see "No silent Closer termination"), the execution-evidence merge gate, squash-merge, issue close, drift check, deploy, loop summary, terminal cleanup, and the terminal comment + state. There is no merge-policy branch — the in-loop merge is the only behavior (see "Closer merge behavior").

**Briefing (template):**
> {{delegation_rule}}
>
> 0. **Git/gh conventions — binding on every commit, push and PR body in this stage.** Your repo's `commit_identity` is `<commit_identity>` (`null` = absent).
>
> {{git_conventions}}
>
> 1. Create a PR (`gh pr create --base <pr_base> --head <branch>`) with a body that follows the **PR-body conventions in §4 of the block at step 0**. Base: `<pr_base>`. The push that preceded this stage used `<git_remote>` — the PR is created against the same remote.
>    - **`code` loop:** PR title `<commit_format>`-compatible (e.g., `feat(scope): ...`).
>    - **`research` loop:** PR title `research(<topic>): findings + follow-up issue spec`.
> 2. **CI base-vs-PR baseline (before merge):** establish the check state for the head of `<pr_base>` and for the PR head, then decide whether anything blocks. **The rule — the read, the state resolution, the collapse and the blocking comparison — is canonical in "CI base-vs-PR baseline" below. Read it there and apply it; do not work from memory and do not reconstruct it from this line.**
> 3. **Never end silently while waiting for CI (see "No silent Closer termination" below):** if merge-relevant checks are still pending, **poll with a bounded cap** — the **CI-poll budget** (`ci_poll_cap_min`), which starts counting when this step starts and is not drawn from the loop wallclock; its value and the reasoning are canonical in "Hard caps". If still pending at the cap, exit with the explicit verdict `ESCALATE: CI pending`: post the issue comment `## [stage:closer] ESCALATE: CI pending` naming the PR number, **which cap fired** (`hard-cap: ci poll` here; `hard-cap: loop wallclock` on the other path that leaves a PR open — see "Hard caps"), the wallclock and the next step (see "No silent Closer termination"), ending with the `model: <model>, effort: <effort>` audit line as in every stage (grammar canonical in "Per-stage model and effort dispatch"). This comment is the machine-readable record of the state — the Pre-Flight open-PR check keys the resume gate on it, on the **literal** marker `## [stage:closer] ESCALATE: CI pending`. **The marker never varies with which cap fired**; a run that renamed it would leave its own finished PR unmergeable by every later run, because the resume gate would no longer match. Which cap fired is carried *inside* the comment and in the release note, never by the marker. **Release the claim** — remove the `claimed:<agent-id>` label and the assignee and post a `## [claim:released] ESCALATE: CI pending — PR #<pr> open (hard-cap: ci poll)` note, like every terminal exit that leaves the PR open. The open PR is the duplicate-work guard: the Pre-Flight open-PR check routes a later run straight to these merge steps, so no agent can redo the finished work.
> **3a.** **Execution-evidence gate (before merge):** read the Tester's `evidence:` block from the issue thread and quote it verbatim in this stage's own comment. **The rule — what blocks, what "missing" means, and the exact exit — is canonical in "Execution evidence" §5 above. Read it there and apply it; do not work from memory and do not reconstruct it from this line.** A blocking read exits `ESCALATE: CI pending` exactly as step 3 does — the same literal marker — and releases the claim per the uniform claim rule. The comment carries the literal tag `evidence-gate: <missing | fail | base-unavailable>` naming the cause; the Pre-Flight open-PR check's resume-gate branches on this tag.
> 4. **Merge:** once no check blocks (step 2), none are pending (step 3), and the execution-evidence gate does not block (step 3a), squash-merge to `<pr_base>`. **The identity check, the exact command, and what to record are canonical in "Squash-merge identity check" below. Read it there and apply it; do not work from memory and do not reconstruct it from this line.**
> 5. **Issue close by pr_base vs default branch (see "Issue close when pr_base ≠ default branch" below), then claim retirement (canonical in "Closer merge behavior" → "Claim retirement on success" — read it there and apply it; do not reconstruct it here):** determine the repo default branch (`gh api repos/<slug> --jq .default_branch`) and compare it to `<pr_base>`.
>    - **`<pr_base>` == default branch:** unchanged — GitHub auto-closes the issue via `Closes #N`.
>    - **`<pr_base>` != default branch:** GitHub will NOT auto-close (the PR did not merge into the default branch). After the squash-merge, **explicitly close the issue** — `gh issue close <n> --comment "Merged via PR #<pr> into <pr_base>; the change reaches the default branch (<default_branch>) at the next promotion."`
>    - **Either branch, once the issue is closed:** retire the claim exactly as canonical above — remove `claimed:<agent-id>` from the issue, then delete the repo label too if no other issue (open or closed) still carries it.
> 6. Drift check before stack rebuild: `diff -r <live_path> <repo_path>` → on drift, warn, no auto rebuild.
> 7. **Type-specific deploy step:**
>    - **`code` loop:** pull locally + rebuild live stack with `<deploy_command>` (from AGENTS.md or registry). Health check post-deploy.
>    - **`research` loop:** no deploy (doc-only). Optionally file a follow-up implementation issue via `/create-issue --type=code` with the spec stub from the doc.
> 8. **(Optional) persist a loop summary** in your knowledge system. If you use [MemPalace](https://github.com/MemPalace/mempalace), call `mcp__mempalace__add_drawer` with palace/wing/room suited to your setup — e.g. `<your-palace>/<your-code-wing>/<your-changes-room>` for code loops (repo + PR + commit + loop summary + Tester findings) and `<your-palace>/<your-personal-wing>/<your-process-room>` for research loops (loop-pattern insights + doc path + follow-up issue spec). Skip this step if your team uses a different knowledge store (or none).
> 9. **Terminal cleanup (worktree, then local branch):** apply the canonical rule in "Git worktree isolation" → "Cleanup — worktree, then local branch" — remove the worktree, then delete the local branch with `git branch -D <branch>`, which the merge's `--delete-branch` did not touch (it is remote-only). Use `-D`, not `-d`: the local branch is never merged locally, so `-d` would refuse it with "not fully merged" — an outcome the `deleted | already absent` vocabulary has no slot for. An already-absent branch is reported as `already absent`, not an error. On worktree-**removal failure**, apply the documented **non-fatal fallback** (prune the worktree registration + delete the local branch + report the leftover directory) from "Git worktree isolation" — never a recursive force-delete. Neither cleanup is ever a blocker for the terminal verdict. Record both results in step 10's comment (`worktree: ...`, `branch: deleted | already absent`). On a successful merge the claim is not released to the pool — it is **retired** instead (step 5: the issue's own `claimed:<agent-id>` label removed, the repo label deleted too if orphaned; canonical in "Closer merge behavior" → "Claim retirement on success"), since the issue is closed (via `Closes #N`, or explicitly for a non-default `pr_base`) and never returns to the pool. On an `ESCALATE: CI pending` exit the claim is released (see step 3 and "Closer merge behavior").
> 10. Issue comment `## [stage:closer] merged & deployed` (or `merged` for research) with PR number + wallclock + drawer ID + the step-4 identity check result and trailer verdict (`co-author trailer: none | present (<rule §3 scope note>)`) + (if applicable) the explicit-close note + any pre-existing-failure list + the cleanup results from step 9 (any leftover-worktree path, and `branch: deleted | already absent`) + step 5's claim-retirement result (`claim: retired, repo label deleted`, `claim: retired, repo label kept (still in use by #<other-n>, ...)`, or — on a wallclock hit landing after the merge but before step 5's retirement sequence completes — `claim: not retired (hard-cap: loop wallclock)`, see "Hard caps"). End the comment with the `model: <model>, effort: <effort>` audit line — one line, both halves always present, grammar canonical in "Per-stage model and effort dispatch". `<effort>` is the level **requested** for this stage, not a claim about what ran.
> 11. Loop state final (`status: "closed"`, `closed_at: ...`).
>
> Parent output (length: see "Issue-comment convention"): PR number, merge commit, deploy status (or n/a for research), drawer ID, wallclock, the quoted execution-evidence block (step 3a), and — if it applied — the CI-pending escalation (naming which of CI or the evidence gate blocked, or both), the pre-existing-failure list, the explicit-close note, a leftover-worktree path, or an `already absent` branch.

**Constraint:** on a stack crash post-deploy: NO automatic revert. Report to the parent; the parent decides with the user.

**The Closer never terminates without a terminal verdict.** The enumerated terminal verdicts are: `merged` (& deployed), or an explicit `ESCALATE: CI pending` / `STOP` naming the PR and the next step. Silent termination while waiting on CI is impossible (see step 3, step 3a and "No silent Closer termination").

#### Squash-merge identity check (report, never a gate)

**Why this exists:** the Closer is the only stage that sees both identities involved in a merge. Both trailer causes and the narrowed gate scope are canonical in `skills/github/SKILL.md` §5 (identity mismatch) and §3 — the Closer already receives them verbatim at step 0 via `{{git_conventions}}`, so they are not repeated here. Decision and evidence: `docs/adr/0022-squash-merge-identity-mismatch.md`.

**What step 4 does, concretely:**

1. **Read both identities.** Branch side: `gh pr view <pr> --json commits --jq '.commits[].authors[].email' | sort -u`. Merging side: `gh api user --jq .email`, falling back to the ambient `git config user.email` when the call fails **or** returns empty/`null` (a private-email account returns a successful `null`, which is not "unavailable" on its own and must fall through the same way).
2. **Compare and note — never block.** If the sets differ, note the mismatch (both addresses) in step 10's comment. If they match, note the match. **Neither outcome changes whether step 4 proceeds to the merge** — this is a report, not a precondition, because attribution cosmetics are not a reason to fail a merge (see `skills/github/SKILL.md` §3, scope).
3. **Merge with an explicit `--subject`/`--body`,** never a bare `--squash` with no message: `gh pr merge --squash --delete-branch --subject "<pr title>" --body "<concise summary — not the full PR-body template>"` — mechanism canonical in `skills/github/SKILL.md` §5.
4. **Verify the outcome on the actual merge commit**, not on the identity comparison alone: `git log -1 --format=%B <merge-sha> | grep -c '^Co-authored-by:'`. Record `0` or the count in step 10's comment. A count above `0` is not itself a STOP — it is evidence the mitigation did not hold for this merge, worth a note for whoever reads the thread next, same posture as every other Closer report.

**This is deliberately narrower than a full attribution audit.** It reads the identity that is *about to* merge and the identities already on the branch; it does not police history, does not touch already-merged commits (out of scope — "Rewriting existing merge commits" is explicitly out of scope for #104), and never turns into a blocking condition regardless of what it finds.

#### CI base-vs-PR baseline

The Closer has a deterministic rule for which red checks block the merge, so a repo carrying pre-existing baseline failures neither blocks forever nor merges over a genuine regression.

**The read, with pagination — the envelope's count is not the page.**

```bash
gh api --paginate "repos/<slug>/actions/runs?head_sha=<full-40-char-sha>&per_page=100" \
  --jq '.workflow_runs[] | {name, status, conclusion, event, created_at}'
```

`total_count` comes from the response envelope while `workflow_runs` is **one page**, and GitHub documents the default page size as 30 (documented, not measured here — this repo has too few runs to page). On a SHA carrying more runs than that — many workflows, or re-runs — a `failure` can sit off-page while the count looks complete, and the collapse below would resolve `passed` on a red commit. Page explicitly; never compare a page of runs against an envelope count.

**Resolve to one of four states, evaluated in this order.** Order matters: `unknown` and `pending` must be settled before any conclusion is read, or an unfinished run gets graded.

| # | State | Condition | Closer behaviour |
|---|---|---|---|
| 1 | **unknown** | the fetch failed (403, network loss, malformed response) **or** `total_count == 0` | **never green.** Report it as a finding in the stage comment, naming the cause, and treat every red check as blocking (fail safe) |
| 2 | **pending** | any run for any name has `status != "completed"` | poll under the bounded cap and, at the cap, exit `ESCALATE: CI pending` — unchanged, and canonical in "No silent Closer termination" below |
| 3 | **failed** | every run has completed and at least one name's collapsed conclusion is **not** in the passing set | apply the blocking comparison below |
| 4 | **passed** | `total_count > 0`, every run has completed, and every name's collapsed conclusion **is** in the passing set | proceed to the blocking comparison |

**The passing set is an allowlist: `success`, `neutral`, `skipped`. Nothing else passes.** That includes `failure`, `cancelled`, `timed_out`, `action_required` and `stale` — and, deliberately, any conclusion value GitHub introduces after this was written. A denylist ("anything that is not `failure`") reads an unfinished run (`conclusion: null`), a cancelled run and a timed-out run as green, and would silently pass a future value nobody here anticipated. The direction of the list is the safety property; do not invert it for brevity.

**`total_count == 0` belongs in `unknown`, not in `passed`.** A commit with no runs has passed nothing. `45ac33e` — the commit before this repo had a workflow — returns `total_count: 0`; reading that as success would merge an unverified change.

**A fetch failure is a finding, not a silent fallback.** This rule exists because the opposite happened: a `403` was worked around, the absence was nearly recorded as green, and the remedy advised was a permission that does not exist. If the read fails, the Closer says so in its stage comment and falls to the safe side. It does not substitute another source without naming the substitution.

**Collapse same-named runs: any non-passing conclusion is a failure.** One workflow produces one run per triggering event, so a PR head normally carries two runs with the same `name` (`push` and `pull_request`). The comparison keys on the check *name*, so those must reduce to one verdict per name. A name collapses to **passing only if every run of that name is in the passing set**. Preferring the latest, or one event, would let a green `push` mask a red `pull_request` on identical code — and if two runs of one workflow on one commit disagree, the check is environment-dependent, which is itself worth blocking on. Fail-safe, and it needs no tie-breaking rule.

**The blocking comparison** (unchanged in substance):

1. A check **blocks the merge only if it is green (or absent) on the base AND failed on the PR** — a newly introduced failure. Name each blocking check in the stage comment.
2. Checks **already failed on the base** are pre-existing: list them in the stage comment as pre-existing and non-blocking; do not silently ignore them, and do not let them block.
3. If the base resolves to **unknown** → treat **every** red check as blocking (fail safe).

Whether the run then *waits* on a still-pending check is the separate concern in "No silent Closer termination".

**What this path does not see, stated without a false reassurance.** `actions/runs` returns **GitHub Actions runs only**. A third-party check run — a CI provider, a coverage or security service — posts a *check run*, not an Actions run, and is **invisible to this rule**. Two cases, and only one of them is safe:

- **Actions-only repo.** A commit with no Actions runs resolves `unknown`, and the Closer refuses to merge blind. Safe direction.
- **Mixed repo (Actions plus a third-party check service).** `total_count > 0` from the Actions side alone, so the read resolves from Actions and **a red third-party check is never seen.** That is not a safe failure direction — it is an unseen failure, and this rule does not protect against it.

A consumer in the mixed case has two honest options: run its loops under a GitHub App, where the Checks API is reachable and this decision should be revisited, or accept the gap knowingly. What this rule must not do is imply a safety it does not have. Rationale, the alternatives weighed, and what would reverse the choice: `docs/adr/0016-closer-ci-read-path.md`.

**Why not the three obvious alternatives** — each measured on 2026-09-03, not assumed:

| Rejected source | Measured behaviour |
|---|---|
| `commits/<ref>/check-runs` | **403** for a fine-grained token, `X-Accepted-Github-Permissions: checks=read`. `checks` is not among the permissions a fine-grained token can be granted — the error says *"not accessible by personal access token"*, not "insufficient permission". Usable only under an App. |
| `commits/<ref>/status` | 200 with `statuses=read`, but it **cannot see Actions at all**. On a commit whose Actions run concluded `failure` it reported `state: "pending"` with `statuses: 0` — a definitive red read as "still waiting". It also cannot distinguish "no statuses exist" from "a status is running" except via `.statuses \| length`. |
| GraphQL `statusCheckRollup` | The aggregate `state` and `contexts.totalCount` are readable; every individual `CheckRun` node comes back `null` with `FORBIDDEN`. It answers "is it green" but not "which check", so it cannot support a per-check base-vs-PR comparison. `gh pr checks` is the CLI wrapper around it and fails the same way once check runs exist — it succeeds on a repo with none, which is its own instance of absence-read-as-green. |

#### Issue close when pr_base ≠ default branch

`Closes #N` only auto-closes when the PR merges into the repository **default branch**. With `pr_base` set to a non-default integration branch (e.g. `pr_base: dev`, `default_branch: main`), GitHub does not auto-close and the issue would otherwise stay open — inconsistently across runs. The deterministic rule:

- The Closer determines the default branch (`gh api repos/<slug> --jq .default_branch`) and compares it to `<pr_base>`.
- **Divergent (`pr_base` != default):** after the squash-merge into `<pr_base>`, **explicitly close the issue** with a comment naming the PR and stating the change reaches the default branch at the next promotion.
- **Equal (`pr_base` == default):** unchanged — GitHub auto-closes via `Closes #N`.

Claim retirement is now unconditional on **both** branches, right after whichever close just happened — canonical in "Closer merge behavior" → "Claim retirement on success", not restated here.

#### No silent Closer termination

The Closer **must never end without a terminal verdict**. Waiting on CI is a bounded state, not a silent hang:

- Poll the merge-relevant checks with a **documented cap of its own** — the CI-poll budget (`ci_poll_cap_min`), counted from the moment polling starts. It does **not** draw on the loop wallclock, so the window CI gets no longer depends on how long the implementation took. Value and reasoning: "Hard caps".
- If checks are still pending at the cap, exit with the explicit verdict **`ESCALATE: CI pending`**, naming the PR number, **which cap fired** (`hard-cap: ci poll`) and the concrete next step: re-run `/work-issue <n>` once CI is green — the Pre-Flight open-PR check routes the re-run to these Closer merge steps for PR #<pr> — or merge manually. This next step actually works — it is not refused by a check the user cannot clear. It satisfies the gate's **evidence** conditions by construction: reaching the Closer at all required a `## [stage:critic] APPROVE`, and this comment names PR #<pr>. The gate's **sole-match** condition is not guaranteed — it depends on the state of the repo at re-run time: if another PR matching issue #<n> is open by then, the check STOPs and names both. Close the stray PR and re-run, or merge PR #<pr> manually. That STOP is clearable by the user without any `gh`/`git` surgery, which is why this next step still holds.
- **Claim handling — RELEASE, like every terminal exit.** The claim (label + assignee) is released in the CI-pending state; a `## [claim:released] ESCALATE: CI pending — PR #<pr> open (hard-cap: <ci poll | loop wallclock>)` note is posted, naming the cap that fired. The open PR — not the label — prevents another agent from redoing the finished work (see the Pre-Flight open-PR check), so holding the claim here would add nothing beyond what the PR already guards. With the PR as the guard, the hold is redundant on every path that leaves a PR open; the rule is uniform, with no exceptions (see "Closer merge behavior" → "Uniform claim rule" for the fuller account, including why an earlier stage-comment-based argument for this no longer applies).
- **The execution-evidence gate (step 3a) applies the same posture, not a new one.** A missing/failed evidence block or a blocking `base: unavailable` is not a wait state — there is nothing to poll — but the exit is identical in every other respect: the same literal `ESCALATE: CI pending` marker, the same claim release and `## [claim:released]` note. It differs in one respect the marker itself cannot carry: the comment also names the cause with the literal tag `evidence-gate: <missing | fail | base-unavailable>` (alongside, or instead of, a `hard-cap: ...` tag — both can appear together when CI was also pending). This is what the Pre-Flight open-PR check reads to route a re-run to a fresh Tester pass rather than straight back into the same blocked gate (see "Pre-Flight stage 0", the resume-gate branch on this tag). The next step is therefore genuinely clearable: re-run `/work-issue <n>` — the resume produces a fresh evidence artifact on the existing branch, and one of three things happens: it clears the gate and finishes the merge; a real regression proceeds to the Critic like any other Tester FAIL reaching it for the first time, under the existing 3-revise cap; or a fresh **PASS that still records `base: unavailable`** — not a FAIL under §4 — routes straight back to these Closer steps and blocks again at 3a on the same cause, unchanged by the re-run. That third outcome is a human's to clear, same as the CI twin above: fix the base ref, or merge PR #<pr> manually. Full rule: "Execution evidence" §5.

## Hard caps

**This section is the canonical statement of the two time budgets and their defaults.** Every other mention in this repo — the Closer's step 3, "No silent Closer termination", the AGENTS.md format block, `CLAUDE.md`, the AGENTS.md template — points here and names no number.

- Max 3 Implementer↔Critic revise rounds (a Visual Reviewer FAIL shares this cap)
- **Loop wallclock — `work-issue.wallclock_cap_min`, default 240 min.** Measured from the run's `started_at`. On overrun the run **exits**: run the terminal cleanup, and release the claim unless the issue has already left the pool — see the two Closer cases below, the only place where a hard-cap hit does not release. **There is no pause state and no wait-for-a-human state.** An earlier wording of this line read "pause + message to the user"; it contradicted the exit rule three lines beneath it and named a behaviour nothing in this file implements — resolved in `docs/adr/0020-split-time-budgets.md`.
- **Closer CI poll — `work-issue.ci_poll_cap_min`, default 30 min.** Measured from the moment the Closer starts polling (step 3), **not** from the run's start and **not** from what is left of the loop wallclock. The window CI gets is therefore a property of CI, not of how long the implementation took.
- 3x build fails in Tester → ESCALATE

Both budgets are optional AGENTS.md fields, both fall back to the defaults above, and neither can STOP a loop on a bad value — see the AGENTS.md mandatory check, step 8. Why they are fields at all rather than literals, how the defaults were derived, and what would reverse them: `docs/adr/0020-split-time-budgets.md`.

On **any** hard-cap hit (revise cap, wallclock overrun, CI-poll overrun, 3x build fail), the run exits — **run the terminal cleanup (worktree + local branch) and release the claim** as described in "Release on failure" below. The one exception is a wallclock hit after the merge has landed on a closed issue: it has left the pool and there is no claim to return.

**A cap hit names which cap.** The terminal comment and the `## [claim:released]` note both carry it: `hard-cap: loop wallclock (<N> min)`, `hard-cap: ci poll (<M> min)`, `hard-cap: 3 revises`, `hard-cap: 3x build fail`. "The loop ran out of time" and "CI ran out of time" are different facts about a run and a reader must not have to guess which happened.

**The two budgets do not overlap, and the loop is not clipped by the wallclock while it polls.** Once the Closer enters step 3, the CI-poll budget alone governs the wait; the loop wallclock does not end a run that is inside the poll. A run may therefore last up to `wallclock_cap_min + ci_poll_cap_min` in total — stated here so nobody has to infer it.

**The wallclock can still fire in the Closer outside the poll, and what decides the verdict is whether the merge has landed — not which step number is running.** Before it lands (PR create, the poll, and the squash-merge command itself up to the point it succeeds) a PR is open and nothing has landed: the run releases the claim, runs the terminal cleanup like every other cap hit, and exits **`ESCALATE: CI pending`** naming the open PR, `hard-cap: loop wallclock`, and the next step (see "No silent Closer termination"). Re-pickup is guarded by the Pre-Flight open-PR check rather than by returning the issue to the pool unguarded.

**Once the merge has landed it is a different exit, and it must not borrow that verdict.** There is no open PR to name and no pending check, so `ESCALATE: CI pending` would describe a state that cannot exist and would promise a resume the Pre-Flight open-PR check can never route. A wallclock hit after the merge therefore exits **`merged`**, because the merge stands, and the terminal comment names `hard-cap: loop wallclock` together with the step that did not complete.

**Whether the claim is released in that window depends on `pr_base`, and the divergent case is the one that strands an issue if this is got wrong.** With `<pr_base>` equal to the default branch, `Closes #N` closed the issue at merge time: it has left the pool, so nothing is **released** — but retirement is not automatic here, it is step 5's explicit three-command sequence (see "Claim retirement on success"), and a wallclock hit landing inside the Closer after the merge but before that sequence completes means retirement itself did not run. That is not a second release path — the issue has still left the pool, and no `## [claim:released]` note is posted — but the terminal `merged` comment must name it, e.g. `claim: not retired (hard-cap: loop wallclock)`, so the leftover `claimed:<agent-id>` label (and, if it was the last carrier, the repo label) is an auditable, named fact rather than a silent leak. With `<pr_base>` **not** the default branch the issue stays open until the Closer's step-5 explicit close, so a wallclock hit before that step leaves an issue that is open **and** still claimed — there the claim **is** released, exactly as on every other exit that leaves the issue in the pool. Only after the explicit close does the no-release rule (and the same not-yet-retired reporting duty, if the cap fires between the close and the retirement sequence) apply.

**The verdict marker is fixed for every exit that leaves a PR open**, whichever cap fired: `## [stage:closer] ESCALATE: CI pending`. That literal is what the Pre-Flight open-PR resume gate matches, so a `hard-cap: ...` marker on this path would strand the run's own finished PR — the gate would fall through to its "markers missing" STOP. The cap name lives inside the comment and in the release note. Outside the Closer no PR exists, and a wallclock hit is reported as `hard-cap: loop wallclock` with no marker to preserve.

## Release on failure

Any exit that is **not** the successful Closer terminal verdict `merged` — a Validator STOP, a loop-type / AGENTS.md STOP, a Pre-Flight open-PR STOP, a Critic ESCALATE, the Closer's `ESCALATE: CI pending`, a hard-cap hit that leaves the issue in the pool, or any abort — must release the claim so no issue is ever left claimed with no path to release (for the exits that leave an open PR behind, the PR itself guards against duplicate pickup):

1. **Run the terminal cleanup first — worktree, then local branch** (if this run created them): apply the canonical rule in "Git worktree isolation" → "Cleanup — worktree, then local branch" (`git branch -D <branch>` for the local ref). On worktree-**removal failure**, apply the documented **non-fatal fallback** (prune the worktree registration + delete the local branch + report the leftover directory) from "Git worktree isolation" — never a recursive force-delete, and the loop still reaches its terminal `stopped` / `escalated` / `aborted` verdict either way.

   **The branch delete is load-bearing on this path — do not simplify it away.** This path exists so **another agent can pick the issue up again**. Without the delete the release does not actually restore the pre-claim state: the abandoned local branch outlives the run, and the retry — which recreates the same branch name whenever `branch_pattern` carries the issue number — dies at `git worktree add` with `fatal: a branch named '<branch>' already exists`. That needs a human at exactly the point where "release on failure" exists to avoid one.

   **The cleanup runs before the release, not after.** Releasing first returns the issue to the pool while its branch still exists, so a second agent can claim it and hit that same `worktree add` collision — the failure this step exists to close. The Closer's `ESCALATE: CI pending` exit already orders it this way (cleanup → comment → release); this path matches it.
2. **Release the claim:** remove the run's own `claimed:<agent-id>` label and its assignee — `gh issue edit <n> --remove-label claimed:<agent-id> --remove-assignee @me` — and post **exactly one** `## [claim:released]` note, carrying both the reason — which for a cap hit names the cap (e.g. `## [claim:released] Validator STOP` / `... ESCALATE` / `... hard-cap: 3 revises` / `... hard-cap: loop wallclock (<N> min)`; see "Hard caps") — **and** step 1's results — `worktree: removed | leftover at <path>` and `branch: deleted | already absent` — the same way the Closer records them. Compose it during step 1 if convenient; post it only here, so it carries the real outcome and there is never a second note.
3. Set the state tracker `status` accordingly (`stopped` / `escalated` / `aborted`) and clear `claim`.

The successful Closer terminal verdict `merged` runs the same terminal cleanup (worktree + local branch) but keeps the audit trail — the issue is closed (by `Closes #N`, or explicitly for a non-default `pr_base`) and is not returned to the pool.

**`ESCALATE: CI pending` RELEASES the claim too — no exception.** The guard against another agent redoing the finished work is the open PR itself, via the Pre-Flight open-PR check — a later run is routed to the Closer merge steps (gated on this PR's Critic `APPROVE` + Closer terminal comment naming it, else a STOP) — so releasing the claim here costs nothing beyond what the PR already guards. So the CI-pending exit releases the claim (label + assignee, `## [claim:released]` note) and runs the terminal cleanup like every other ESCALATE — the **remote** branch and the PR live on, so no local state is needed to finish the merge. The Closer never holds a claim; see "Closer merge behavior" (uniform claim rule) and "No silent Closer termination".

## Channel updates

When invoked from a `<channel>` inbound:
- **Pre-stage-1:** "Loop for #N starting, stage 1 running"
- **Between stages:** `Stage N (<name>) → <verdict>. Stage N+1 starting.`
- **Pre-Tester with live ping:** warn if the test plan produces a live-channel ping
- **Post-Closer:** success report with PR link, wallclock, iteration count

Channel/chat_id taken from the inbound meta.

## Issue-comment convention

Every comment starts with `## [stage:<name>] <verdict>` to keep the audit log scannable. Subagents receive this in their briefing.

**This section covers both surfaces a stage produces** — the issue comment it posts and the parent report it returns. It is the canonical statement for both. Every stage site in this file and in the subagent briefs carries its own required-field list and, for length, points here; none of them restates the rule.

**Length calibration.** Match the length to what the next stage and a later reader need. Lead with the outcome, then the fields the site requires, and stop there. Do not pad with filler sections, redundant summaries or boilerplate, and do not truncate a genuine finding to reach a size. There is no word cap and no word floor: the field list at each site fixes *what* must be present, this rule fixes *how much*. Rationale — why a number is the wrong instrument here — in `docs/adr/0019-length-calibration-over-word-counts.md`.

## Scope boundaries vs. /create-issue and /init-agents

| Skill | When |
|-------|------|
| `/init-agents` | Repo has no AGENTS.md yet → bootstrap (once per repo) |
| `/create-issue` | Idea → fully-specified GitHub issue (genesis phase) |
| `/work-issue` | Issue with spec → build loop to a terminal verdict (execution phase; the Closer merges in-loop) |

If `/work-issue` is called without an issue number OR the issue has no spec (no AC, no files-to-touch) → ask the user: "Issue is incomplete. Should I call `/create-issue --refine <num>`?"

If AGENTS.md is missing in the repo → STOP with a pointer to `/init-agents` (see the pre-flight check above). No auto-fallback.

## What this skill does NOT do

- Does not plan new issues itself (that is `/create-issue`) — when a Critic or Tester finding warrants its own issue beyond the current run's REVISE cap, the redirect route is `/create-issue --from-loop <issue>` (canonical: `skills/create-issue/SKILL.md`, "Loop-finding redirect"; label contract: `skills/plan-issues/SKILL.md`, "Label contract — `found-in-loop`"; design rationale: `docs/adr/0026-issue-scope-discipline.md`)
- Does not create AGENTS.md itself (that is `/init-agents`)
- Cross-repo dependencies are only checked as CLOSED, not auto-worked beforehand
- Does not create ADRs
- Does not auto-revert on a stack crash

## Loop-workflow pattern (reference)

| Field | Here |
|-------|------|
| Trigger | `/work-issue <num> [--repo <slug>]` |
| Iteration | 5 stages, revise loop on Critic REVISE |
| Persistence | issue comments + `<temp_dir>/loop-*.json` (temp dir resolved from `$TMPDIR`/`$TEMP` per OS — see "State tracker") + optional knowledge-store drawer at the end |
| Stop criterion | Critic APPROVE + Closer terminal verdict (`merged` + deploy OK, or `ESCALATE: CI pending`) |
| Escalation | Message to the user on STOP/ESCALATE/hard-cap |

## See also

- `skills/init-agents/SKILL.md` — mandatory bootstrap BEFORE the first run in a repo
- `skills/create-issue/SKILL.md` — issue-genesis phase
- `skills/work-issue/references/repo-registry.yaml.example`
- `skills/work-issue/references/subagent-briefs/code-implementer.md` — code-loop brief
- `skills/work-issue/references/subagent-briefs/research-implementer.md` — research-loop brief
- `skills/init-agents/references/AGENTS.md.template`
