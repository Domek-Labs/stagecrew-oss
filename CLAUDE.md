# stagecrew — agentic loop workflow

**Turn a GitHub issue into a reviewed, merged PR (or research findings) with a 5-stage agent pipeline that merges the approved PR in-loop.**

Pure-reader plugin: all coding standards live in your repo's `AGENTS.md`, not in this plugin. You bootstrap once per repo, then any issue can flow through the loop.

**Multi-type system:** the same 5-stage skeleton powers both
code loops (software implementation) and research loops (knowledge generation
with a test matrix). Each type has its own issue template and subagent brief — see the
"Loop Types" section below.

## Quickstart

```
1. /init-agents --repo <owner>/<slug>     # bootstrap AGENTS.md (once per repo)
2. /create-issue "<your idea>"            # idea → fully-specified GitHub issue
3. /plan-issues                           # work-list + area:/bundle: labels + start-time collision report (optional, recommended for multi-issue runs)
4. /work-issue <num>                      # issue → reviewed, merged PR via 5 stages (the Closer merges in-loop)
```

Each step is its own command; there is no single-command wrapper around them. Step 3 is optional for a single issue and recommended once several are in flight.

## The 4 Skills

| Skill | Phase | What it does |
|-------|-------|--------------|
| `/init-agents` | Bootstrap | Writes `AGENTS.md` at the repo root: YAML frontmatter with the mandatory standards fields (branch pattern, syntax check, smoke test, hard gates, AC templates, ...) plus its optional fields — the field list and its total are canonical in `skills/init-agents/SKILL.md` — + Markdown body (architecture, conventions, known gotchas). One-time per repo. Codebase-memory provides intelligent defaults. |
| `/create-issue` | Genesis | Turns an idea into a fully-specified GitHub issue with spec-standard sections (Idea/Spec/AC/Files-To-Touch/Test-Plan/Out-of-Scope). Auto-injects AGENTS.md's `ac_templates`, plus the ACs of every enabled `strategy.gates` gate. Sets the `area:<name>` subject label at creation (spec-dialog question 8; skipping is allowed, guessing is not), and the `feature:<name>` axis label where the repo declares `strategy.feature_axis` (question 10). Requires a half-day estimate at creation (question 12; refuses above the declared cap, shaped like the unimplemented-loop-type error) and, for any stretch of work, a milestone carrying a `due_on` date (question 11) — canonical: `skills/create-issue/SKILL.md`, "Effort estimate (half-days) and the four-half-day cap" and "Work-stretch end date (`due_on` anchoring)". `--from-loop <issue>` redirects a Critic/Tester finding into its own issue — sets `found-in-loop` and hard-suppresses the auto-handoff question below for it, rather than offering it and risking the redirect turning back into an appending of scope; label contract: `skills/plan-issues/SKILL.md`, "Label contract — `found-in-loop`". Design rationale for all three: `docs/adr/0026-issue-scope-discipline.md`. Calls `/init-agents` as a pre-step if AGENTS.md is missing. |
| `/plan-issues` | Planning | Derives the **actionable work-list** from the open issues before work starts — `<goal>` minus every issue carrying a `waiting-on:*` label — and resolves the two **stable** issue labels `area:<name>` (what is this about?) and `bundle:<name>` (what ships together?). Detects stale `blocked` labels, and prints a **start-time collision report** that is written nowhere: open PRs whose *actual* diffs overlap a candidate, declared file overlap demoted to a hint with its reliability caveat in the output, declared paths that do not exist in the repo, and open dependencies. Outputs the plan for human review; writes `area:`/`bundle:` on confirmation — `bundle:` only where a source already existed, never invented. Where the repo declares `strategy.feature_axis`, it also groups the work-list by `feature:` and notes any feature over `flag_over` open issues (a note, never a STOP); where it declares `strategy.gates`, the plan prints the gate state (state only — no gate is evaluated or enforced here). Contract for the `area:`/`bundle:` labels — and, canonical in the same file, the `goal:`/`waiting-on:` axes, `feature:` and `found-in-loop`: `skills/plan-issues/SKILL.md`, "Label contract". Position in pipeline: after `create-issue`, before `work-issue`. |
| `/work-issue` | Execution | Drives a specified issue through 5 stages (Validator → Implementer → Tester → Critic → Closer). Pure-reader: all standards come from AGENTS.md. The Validator STOPs on an AC that names no observable or a Test Plan missing a per-test execution path (see `skills/work-issue/SKILL.md`, Stage 1 briefing). The pre-flight reports (never STOPs) a `strategy.gates` gate whose underlying mechanism is unconfigured, and separately probes the external tools the shipped skills' own instructions invoke (e.g. `python3`, `grep`) — reporting a miss once, degrading where a fallback exists, and STOPping only where a mandatory pre-flight step has no working tool left (canonical list, derivation and the ugrep finding behind it: `skills/work-issue/references/tool-requirements.md`). The Critic answers an **out-of-diff falsification check** on every run — where the diff changes a default, a terminal verdict, a declared field's semantics or a documented behaviour, it searches the repo's prose *outside* the diff for statements the change falsified and raises each one as a REVISE item (see `skills/work-issue/SKILL.md`, "Out-of-diff falsification check"). Auto-PR on APPROVE; once CI is green the Closer **merges in-loop** — squash-merge, issue close, remote-branch delete, and the one deploy (see `skills/work-issue/SKILL.md`, "Closer merge behavior"). Issue comments serve as the audit log. |

## Umbrella Skill: `/loop`

If you do not know which sub-skill you need, just call `/loop` — it asks one clarifying question and routes you. Triggers on "loop", "loop workflow", "work issue", "spec build", "coding loop", "github workflow".

## Reference Skill: `github`

A convention reference (not a loop phase), and the **canonical source** for the git/gh interaction rules every committing stage follows — read-only-`.git` fallback, commit author identity, `no_unconfigured_coauthors`, PR-body conventions, the squash-merge co-author caveat, non-interactive shell. The rules themselves live only in `skills/github/SKILL.md` and are restated nowhere in this repo except the one declared copy in `skills/init-agents/references/AGENTS.md.template` (see `AGENTS.md` hard gate 8).

Stages that cannot follow a pointer get them by **transclusion**: `skills/github/SKILL.md` carries a delimited block (`<!-- BEGIN git_conventions -->` … `<!-- END git_conventions -->`), and `/work-issue`'s render step substitutes it for the `{{git_conventions}}` placeholder in the two Implementer briefs and the Closer briefing at dispatch time — the same substitution that fills `{{commit_identity}}` and `{{git_remote}}`, but sourced from inside the plugin rather than from the target repo's AGENTS.md. Mechanics: `skills/work-issue/SKILL.md`, "Transcluded git/gh conventions (`{{git_conventions}}`)"; rationale: `docs/adr/0012-transcluded-git-conventions.md`.

## Loop Types

| Type | When | Deliverable | Template | Implementer brief |
|------|------|-------------|----------|-------------------|
| `code` (default) | feature, fix, refactor, dependency update | PR with code diff + tests | `skills/create-issue/references/issue-templates/code.md` | `skills/work-issue/references/subagent-briefs/code-implementer.md` |
| `research` | knowledge generation, test-matrix study, library comparison, API behavior probe | `docs/research/<topic>-<date>.md` + follow-up issue spec | `skills/create-issue/references/issue-templates/research.md` | `skills/work-issue/references/subagent-briefs/research-implementer.md` |

Type selection:
- `/create-issue --type=<code|research> "<idea>"` — explicit
- Otherwise auto-inferred from keywords in the user text (`feat`/`fix` → code, `research`/`benchmark` → research)
- Otherwise `loop_types.default` from AGENTS.md (typically `code`)

`/work-issue` reads the `loop-type:<type>` label from the issue and dispatches to the
matching subagent brief. The Tester/Critic/Closer stages stay structurally identical
but check type-specific criteria (build GREEN vs. doc quality, code-diff quality vs.
"follow-up issue spec ready to start").

Both loop types are exercised end-to-end: code loops ship a PR with a diff + tests,
research loops ship a findings doc plus a follow-up implementation-issue spec
(pick a research topic and call `/work-issue --type=research`).

## Optional features

### Per-stage model and effort selection (`models:` and `effort:` blocks in AGENTS.md)

Two **opt-in** AGENTS.md YAML frontmatter blocks (inside `work-issue:`) that set a model alias and a reasoning-effort level per loop stage. When `models:` is set, `/work-issue` spawns each stage's subagent with the resolved model instead of inheriting the session model. `effort:` is the **second axis on the same mechanism** — same six stage keys, same three resolution tiers, same never-STOP posture, same audit line.

Absent blocks → zero behavior change on either axis. Full schema and enforcement details in `AGENTS.md` under "Model Selection"; design rationale in `docs/adr/0003-model-selection.md` and `docs/adr/0017-per-stage-effort-axis.md`, with the Implementer default flip in `docs/adr/0018-implementer-model-default.md`.

**Alias values:** `opus`, `sonnet`, `haiku`, `fable` — never a pinned model id. **Effort levels:** `low`, `medium`, `high`, `xhigh`, `max`. An unknown / unavailable / rejected alias falls back to inherit; an unknown or unaccepted level falls back to the default. Either way: note it in the stage comment, never STOP.

**`effort:` is declarative today.** A repo that sets it buys an intent record, not a behaviour change: the level is resolved and recorded as *requested*, never applied. The canonical statement of the gap, and of what would change when the dispatch gains the parameter, is in `skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch".

**Retrofit path for existing repos:**

```
/init-agents --models [--repo <slug>]                       # interactive preset picker (both axes)
/init-agents --models --preset balanced [--repo <slug>]     # non-interactive
```

Presets: `balanced` (recommended), `economy`, `quality`, `inherit` (removes both blocks). A preset sets both axes. Preset definitions and the recommended per-stage mapping — models and effort — are in `skills/init-agents/references/model-presets.md` (canonical source), which `/work-issue` never reads: no model alias and no effort level is a default anywhere in these skills.

`/init-agents --refine` offers the blocks when absent but never writes them autonomously.

### Area vocabulary (`plan-issues:` block in AGENTS.md)

An **opt-in** AGENTS.md YAML frontmatter block listing the subject areas a repo's issues fall into. `/create-issue` offers those values when it sets the `area:<name>` label; `/plan-issues` validates against them — an unknown value **warns and is still written**, never STOPs.

Absent block → every `area:` value is accepted and `/plan-issues` notes once per run that they are unvalidated. Zero behavior change, and the block is deliberately **not** part of `/work-issue`'s mandatory AGENTS.md completeness pre-flight.

The `area:` / `bundle:` label contract — grammar, lifetime, the three legal sources each label accepts, and why `bundle:` is never invented — is canonical in `skills/plan-issues/SKILL.md`, section "Label contract". `/init-agents` offers the block in its interactive and `--refine` dialogs and never writes it autonomously.

### Goal + waiting-on axes (`plan-issues.goals` in AGENTS.md)

Two orthogonal issue-label axes keep a backlog actionable: a mandatory-when-opted-in **`goal:<value>`** ("what cannot be reached without this issue", exactly one) and an optional **`waiting-on:<value>`** ("what blocks this right now", zero or one). The actionable work-list is a **query** — `<goal>` minus every issue carrying `waiting-on:*` — never a stored label.

Opt in via an optional `plan-issues.goals` list (`+ goal_default`, `+ configurable goal_prefix` / `waiting_prefix` defaulting to `goal:` / `waiting-on:` so nothing is hardcoded). Absent block → zero behavior change. When set, `/create-issue` offers the goals as a single-select and prints the check-question "What happens if we try to reach the goal WITHOUT this issue?"; `/init-agents` creates the `goal:*` labels. `/work-issue`'s pre-flight STOPs on any `waiting-on:*` label (specified but not actionable), at the same severity tier as a missing AGENTS.md — this applies even with no `goals` block, since the prefix has a default.

The `goal:` / `waiting-on:` contract — grammar, cardinality, the work-list query, the check-question, and the label-retirement rule (a superseded label is never deleted; checks use `--state all`) — is canonical in `skills/plan-issues/SKILL.md`, section "Label contract — `goal:` and `waiting-on:` (canonical)". Design rationale in `docs/adr/0006-label-axes.md`.

### Component Registry (`components:` block in AGENTS.md)

An **opt-in** AGENTS.md YAML frontmatter block that declares a repo's canonical component set (frontend components, backend value objects, aggregates). When set, the loop enforces reuse: the Validator gates in-scope issues against the registry, the Implementer refuses to inline duplicates, and the Critic runs a dupe-detection pass over the declared code globs. `usage_policy` picks the enforcement level — `prefer_existing` warns, `strict` STOPs and requires an ADR link.

Absent block → zero behavior change. Full schema and enforcement details in `AGENTS.md` under "Component Registry", template in `skills/init-agents/references/components-registry-template.md`, design rationale in `docs/adr/0001-components-registry.md`.

### Strategic software development (`strategy:` block in AGENTS.md)

An **opt-in** top-level AGENTS.md YAML frontmatter block that gives the existing strategic hooks — the ADR practice, `components:`, `smoke_test` / `ac_templates`, `docs_command` — one coherent home, and adds a configurable `feature:` issue-label axis and optional PRD/SDD pointers. The `gates:` booleans switch those existing mechanisms from optional to strategically-required; they add no machinery of their own.

Absent block → zero behavior change: no feature question, no feature grouping, no note, no gate injection, no gate report.

**`feature_axis`.** When the block is declared, `/create-issue` asks for the feature (free text, existing `feature:*` labels suggested) and sets the label — mandatory only for the issue types in `require_on` (default `[enhancement]`), offered for the rest — and `/plan-issues` groups the work-list by feature and prints a **note** for any feature with more than `flag_over` open issues ("is the decomposition intended?"). The note is never a STOP: a large feature is legitimate, and the note asks a human to look. The prefix resolves against `strategy.feature_axis.prefix` (default `feature:`), so nothing is hardcoded.

**`gates:`.** The four booleans (`architecture_adr`, `component_reuse`, `test_evidence`, `documentation`) are honored in three places, each pointing at the mechanism that already owns it: `/create-issue` injects the enabled gates' ACs, `/work-issue`'s pre-flight **reports** — never STOPs — a gate whose mechanism is unconfigured, so a repo can adopt gates one at a time, and `/plan-issues` prints the gate state in the plan. A gate never becomes a precondition: a repo with a `components:` block and no `strategy:` block gets the Component Reuse Check exactly as before. `false` behaves like an undeclared gate.

**The bootstrap.** `/init-agents` **offers** the block in its interactive and `--refine` dialogs — never in `--auto`, never autonomously — and is **design-doc aware**: an existing PRD/SDD is recorded in `design_docs` and pointed at, and only when none exists does a short strategic Q&A (purpose/non-goals, leading decision, core components, test bar) run, writing its answers into the **AGENTS.md body**. No second document is ever scaffolded, and the three `design_docs` states are distinct — a path, a declared `""` ("decided: none"), and an absent key ("not decided yet", which `--refine` re-asks). Declaring the block creates **no** labels: the feature axis has no declared vocabulary, so `feature:` labels are created on demand by `/create-issue`. Declining the offer leaves `/init-agents` behaving exactly as it did before.

Canonical description of the block's shape and opt-in semantics in `AGENTS.md` under "Strategic Software Development"; the `feature:` label contract itself — grammar against the resolved prefix, cardinality, lifetime, legal sources and the retirement rule — is canonical with the other issue-label contracts in `skills/plan-issues/SKILL.md`, section "Label contract — `feature:` (canonical)"; what each gate injects (incl. the ADR Check text and the docs AC-template lookup) in `skills/create-issue/SKILL.md`, "Strategic Gates"; what "unconfigured" means per gate and the report itself in `skills/work-issue/SKILL.md`, "Optional `strategy.gates` consistency report"; the offer dialog, the design-doc detection and the strategic Q&A in `skills/init-agents/SKILL.md`, "Optional block: `strategy:`"; design rationale in `docs/adr/0008-strategy-block.md`, `docs/adr/0009-strategy-gates.md` and `docs/adr/0010-init-agents-design-docs.md`.

### Commit attribution (`commit_identity` field + `no_unconfigured_coauthors` gate)

The optional `commit_identity` field (`name` + `email`) in the AGENTS.md `work-issue:` namespace fixes the author identity used for every loop commit, so attribution never depends on ambient `git config` or assistant memory. It pairs with the `no_unconfigured_coauthors` hard-gate. Absent field → zero behavior change; a repo that never sets it keeps working exactly as before.

**What the stages do with the field and the gate is not restated here** — both are git/gh interaction conventions, canonical in `skills/github/SKILL.md` (§2 and §3) and reaching the committing stages by transclusion (see "Reference Skill: `github`" above). This section records only that the field exists, where it lives and that it is optional.

### Loop time budgets (`wallclock_cap_min` and `ci_poll_cap_min` fields in AGENTS.md)

Two optional integer fields in the AGENTS.md `work-issue:` namespace, in minutes: `wallclock_cap_min` budgets the whole loop, `ci_poll_cap_min` budgets the Closer's wait on CI. They are **two budgets, not one** — the CI poll is counted from the moment polling starts, so how long CI is given no longer depends on how long the implementation took. Absent, malformed or non-positive values fall back to the documented defaults and are never a STOP; neither field is part of the mandatory completeness check.

**The two numbers are not restated here.** The defaults, the derivation behind them, and the rule that a cap hit must name which cap are canonical in `skills/work-issue/SKILL.md`, "Hard caps"; the decision, the evidence and what would reverse it are in `docs/adr/0020-split-time-budgets.md`. This section records only that the fields exist, where they live and that they are optional.

## Nested subagents: guidance, visibility, and the operator's caps

Every `/work-issue` stage runs as a subagent, and a subagent can dispatch subagents of its own. The plugin covers that in two halves, and it is deliberate that only one of them is the plugin's to do.

**Guidance and visibility ship inside the briefings.** When a nested spawn is warranted, what it inherits on the model and effort axes, and the conditional `delegation:` line a spawning stage writes immediately above its audit line are **one rule with one canonical home** — the delimited `delegation_rule` block in `skills/work-issue/SKILL.md`, transcluded into every stage briefing that can spawn. **None of it is restated here**, and no brief carries a copy: this section records only that the rule exists and where it lives. Design rationale in `docs/adr/0021-delegation-rule-and-spawn-visibility.md`.

**Hard caps are the operator's, not the plugin's.** A skill is text. It can advise and it can record; it cannot limit how many agents a session launches. Claude Code documents two environment variables that do, and they are the only documented mechanism that caps subagent spawning:

| Variable | What it bounds | Documented default |
|---|---|---|
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | how deeply subagents may nest | 3 layers below the main conversation |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | how many subagents may run at once; exceeding it returns `Concurrent subagent limit reached` | 20 |

Both are settable in `settings.json` under the `env` key. Documentation: <https://code.claude.com/docs/en/sub-agents.md>.

**This plugin never sets either one**, and nothing in the skills claims to enforce a cap. It names them so an operator who wants a deterministic bound knows where that bound lives — the loop declares what it needs, the container stays the operator's.

## Parallel-safe `/work-issue`

`/work-issue` is **parallel-safe**: two agents/terminals can run it concurrently on the same repo without colliding. Each run **claims** its issue in the Stage 0 pre-flight (assignee + `claimed:<agent-id>` label + `## [claim]` comment, with a read-after-write confirm that takes over a stale claim — announced in the issue as `## [claim:taken-over]` and reusing an existing branch of the dead run where one exists — and lets the earliest **active** claim win — the staleness rule, `claim_stale_minutes` and evaluation order are canonical in `skills/work-issue/SKILL.md`, "Claim protocol"; a run's own `[stage:*]` progress comments do not by themselves keep its claim looking active, per `docs/adr/0024-claim-lifecycle.md`) and works in an **isolated git worktree** instead of the primary checkout. The claim is released on any failure exit (STOP/ESCALATE/hard-cap/abort) so the issue returns to the pool, and on the one Closer exit that leaves the PR open (`ESCALATE: CI pending`) — no path holds a claim on an open PR; there a Stage 0 **open-PR check** guards against duplicate pickup instead of the label (it routes a re-run to the Closer merge steps for the existing PR, but only if that PR carries a Critic `APPROVE` and a Closer terminal comment naming it and is the only match — otherwise it STOPs). On the successful `merged` verdict the claim is instead **retired** — the issue's `claimed:*` label is removed and the repo label deleted too once no other issue carries it — canonical in `skills/work-issue/SKILL.md`, "Closer merge behavior" → "Claim retirement on success". At the loop's terminal verdict (`merged`, `ESCALATE: CI pending`, or abort/ESCALATE) the run cleans up what it created: the worktree **and** the local branch. The local delete is needed because `gh pr merge --delete-branch` is remote-only, and it is what lets a released issue actually be retried — a leftover local ref makes the retry fail at worktree creation. It never touches the remote branch, which on a CI-pending exit deliberately survives so the resume can merge from it. Canonical rule: `skills/work-issue/SKILL.md`, "Git worktree isolation" → "Cleanup — worktree, then local branch". There is no controller and no ready-queue yet.

**A failed worktree removal is non-fatal — the separate fallback route.** When `git worktree remove` fails (long paths / `node_modules` — even with `core.longpaths=true`), the loop does not abort: it prunes the git worktree registration, deletes the local branch, and reports the leftover directory to the user for manual removal, still reaching a terminal verdict. A recursive force-delete is **never** the prescribed fallback (it could destroy state another concurrent loop depends on).

**State-tracker path is OS-portable.** The tracker file is resolved from the environment (`$TMPDIR` / `$TEMP`) with a per-OS default (`/tmp` on Linux/macOS, `%TEMP%` on Windows) instead of a hardcoded `/tmp`, so native tooling on Windows can open it. On Linux/macOS the default is still `/tmp`, so existing runs are unchanged.

**Non-`origin` remotes.** Push, PR create, and branch cleanup use the repo registry's `git_remote` field (via the `{{git_remote}}` placeholder), falling back to `origin` when unset — so a repo whose GitHub working remote is not named `origin` is handled correctly.

## Tester: scope-aware `smoke_test`

`smoke_test` in AGENTS.md is **either** a plain string (unchanged) **or** a scope mapping (`backend` / `frontend` / `default`, plus optional `parallel_safe` and `scopes:`). The `/work-issue` Tester resolves the scope from the diff paths — against `components.code_globs`, or the mapping's own `scopes:` globs when no `components:` block is set — and runs only the matching command. A diff that matches no scope is skipped as "smoke test not applicable to this diff scope", with the reason named in the Tester stage comment. A `parallel_safe: false` smoke test (e.g. `docker compose up -d --force-recreate`) is skipped — with the reason recorded — when another active claim exists on the repo. The plain-string form is a full zero-behaviour-change fallback.

## Tester: execution evidence

Where `smoke_test` resolves to a real command, the Tester's proof is a base-vs-branch test-execution comparison rather than a stage comment's assertion: a throwaway reference run at `pr_base`, plus a revert check that proves any new or changed test actually depends on the change it ships with, both posted as a fenced `evidence:` block the Closer reads before merging. A no-op `smoke_test` resolves the gate to not-applicable on both sides; a `research` loop resolves it the same way, unconditionally. A docs-only diff (this repo's normal case, being Markdown-only) bypasses the whole Tester stage before any of this runs, and the Closer's gate below treats that bypass as non-blocking rather than a missing block. Canonical procedure: `skills/work-issue/SKILL.md`, "Execution evidence"; rationale: `docs/adr/0023-execution-evidence.md`.

## Closer: in-loop merge, CI baseline, and non-default `pr_base`

**`/work-issue` merges in-loop.** Once the Critic APPROVEs and CI is green, the Closer creates the PR, squash-merges it to `pr_base`, closes the issue, deletes the remote branch, and runs the one deploy. This is the only behavior — there is no merge-policy field (a legacy `merge_policy` key in an AGENTS.md is inert). Semantics: `skills/work-issue/SKILL.md`, "Closer merge behavior".

The Closer applies five deterministic rules and **never terminates without a terminal verdict**:

- **CI base-vs-PR baseline.** Before merging, the Closer establishes the check state on both `pr_base` and the PR head and blocks only on a failure the PR newly introduces — and it **refuses to merge when it cannot establish the state at all**, rather than reading silence as success. It reads GitHub Actions, so a check posted by a third-party service is outside what it can see. The rule, its state resolution and its limits are canonical in `skills/work-issue/SKILL.md`, "CI base-vs-PR baseline"; the reasoning and what would reverse it in `docs/adr/0016-closer-ci-read-path.md`.
- **Execution-evidence gate.** Before merging, the Closer also reads the Tester's `evidence:` block (see "Tester: execution evidence" above) and quotes it verbatim in its own terminal comment. A block that is genuinely missing (a docs-only bypass does not count, see above), reports a failed comparison, or reports an unreadable baseline while the repo declares a real `smoke_test` **blocks the merge** — the same `ESCALATE: CI pending` exit the CI baseline uses, naming the evidence problem instead of, or alongside, a pending check. This is not a dead end: a re-run routes through a fresh Tester pass on the existing PR before returning to the merge steps, so the block genuinely clears. Canonical rule: `skills/work-issue/SKILL.md`, "Execution evidence" §5.
- **Never end silently while waiting on CI.** Pending checks are polled against the Closer's **own** budget (`ci_poll_cap_min`), counted from the moment polling starts and never drawn from what is left of the loop wallclock; if still pending at the cap, the Closer exits with an explicit `ESCALATE: CI pending` verdict naming the PR number, **which cap fired**, and the next step — a `/work-issue` re-run (routed straight to the merge steps by the open-PR check, subject to its resume gate) or a manual merge. The claim is **released** in that state — the open PR, not the label, guards the finished work against duplicate pickup. The verdict marker is the same string whichever cap fired, because the resume gate matches it literally.
- **Issue close when `pr_base` ≠ default branch.** `Closes #N` only auto-closes on a merge into the default branch. When `pr_base` diverges from the repo default branch, the Closer **explicitly closes** the issue after the merge (with a comment naming the PR and stating the change reaches the default branch at the next promotion) and removes the `claimed:<agent-id>` label so a later run does not misread a leftover claim as active. Where `pr_base` equals the default branch, behaviour is unchanged.
- **Squash-merge identity check (report, never a gate).** A squash-merge can carry a `Co-authored-by:` trailer for a reason distinct from a dirty branch commit: the account performing the merge differing from the identity that authored the branch commits (typically a `commit_identity` vs. the merging account, same human, two addresses). The Closer compares the two identities before merging and notes a match/mismatch — this **never blocks the merge**, because attribution cosmetics are not a merge-blocking condition — and merges with an explicit `--subject`/`--body` rather than a bare squash, which is **expected to** avoid the trailer by replacing GitHub's default-generated squash message with one supplied directly (an inferred mechanism, not a documented GitHub guarantee, verified per merge — see the ADR). The two identities still differ either way; only the trailer is avoided. Mechanics: `skills/work-issue/SKILL.md`, "Squash-merge identity check"; the two trailer causes and the narrowed scope of `no_unconfigured_coauthors`: `skills/github/SKILL.md` §3 and §5; decision record: `docs/adr/0022-squash-merge-identity-mismatch.md`. **Removing `commit_identity` is not a fix** — it trades a known mismatch for whatever the ambient session default happens to be.

## Structural check layer (`checks/`)

This repo runs a small, model-free check layer over its own structure. It exists because most regressions in a Markdown-only tool are structural, not behavioural: a skill naming a field the template no longer has, a `references/` pointer that survived a file move, a README that stopped listing a skill that shipped. All of those degrade every loop that runs afterwards, and none of them needs a model to detect.

**What it guarantees.** Six checks, each deriving its expectation from a canonical file rather than carrying a copy of the rule: the canonical `work-issue:` field set is present in the AGENTS.md template; every `references/...` path a `SKILL.md` mentions resolves; `README.md` lists every skill under `skills/`; every `SKILL.md` has well-formed frontmatter with `name` and `description`; no file outside the version manifest names the current version; and the tree carries none of the patterns declared in `checks/release-denylist.json` for the public release mirror (see "Public release mirror" below). Findings name a file and a line. The entrypoint exits non-zero on any finding.

**What it does not reach.** Structural checks plus one content scan (check 7, below), not behavioural coverage. None of the six read prose for meaning, so a semantic contradiction between two documents is invisible to the layer — that class belongs to the Critic's out-of-diff falsification check. No model, no API key.

**How to run it, how to add a check, and which canonical source each check reads: `CONTRIBUTING.md`.** Why it is built this way, including the Markdown-only override it required: `docs/adr/0015-structural-check-layer.md`.

**Two invocation sites, one entrypoint.** `syntax_check` in `AGENTS.md` runs it inside the loop, so a finding reaches the Critic before it votes; `.github/workflows/structural-checks.yml` runs the same entrypoint on every push and pull request, including those no loop touches.

**CI is advisory, not enforcing.** This repo is private, and branch protection on a private repo requires GitHub Pro, so a *required* status check is unavailable. The workflow buys independent verification and coverage of non-loop pushes — it does not buy enforcement, and nothing stops a red run being merged past. Do not read the presence of CI here as a gate.

## Public release mirror

This repo (private, carries issues, loop history and internal references) has a public edition mirrored to a separate repo, `Domek-Labs/stagecrew-oss` by default. The private repo is always the source of truth; the public repo is a **publish target**, never a second place development happens — issues, loop-stage comments and claim labels all stay private. Full rationale, the squash-per-release-vs-history-transfer decision and its cost (external PRs against the public repo cannot be merged directly back), and why no GitHub Actions job performs the push: `docs/adr/0027-public-release-mirror.md`.

**When it runs.** By hand, on a human decision — never scheduled, never on a git push, never from CI. The trigger is a version tag; the mirror itself is `node ops/release-mirror.js`.

**Who triggers it.** The maintainer, after the loop that prepared the release has merged and the repo has a real tag to publish.

**What it refuses on**, each before any network access, each naming the failed condition: a dirty working tree, a HEAD that is not the tagged commit being released, a missing `checks/release-denylist.json`, and a failing run of check 7 (`checks/check-7-release-scan.js`, below) — the denylist scan is invoked, never reimplemented. A real (non-dry-run) push additionally refuses while the denylist's `pending` entries are unfilled, naming them; `--dry-run` only warns on that one condition. `--dry-run` reports the target repo, the prospective commit (message, parent, tree) and the file count, and performs no network write; a real run that fetches a public HEAD identical to the release tree no-ops ("nothing to publish") instead of creating an empty commit. The public commit's author/committer identity comes from AGENTS.md's `commit_identity`, read at run time, never from the ambient `git config`. Testing this script itself against a scratch target (e.g. a local bare repo) rather than the real public repo: `--remote-url`, documented in the script's own header comment.

**Check 7 — the release denylist scan.** Part of the structural check layer above (auto-discovered, no edit to `checks/run.js` needed): the tree must carry none of the patterns declared in `checks/release-denylist.json` — private filesystem paths, an employer codename fragment, and credential-shaped strings. It scans exactly the tracked file set (`git ls-files`), the same set the mirror publishes, so a file the mirror ships is a file this check has scanned; a tracked file without a NUL byte is treated as text, one with a NUL byte is skipped as binary (noted in the output), and a checkout with no working `git` falls back to a fixed-extension disk walk (also noted). That data file is excluded both from the mirror's published tree and from the scan's own scan set, so the file that names what must never be published never gets published itself; an absent data file (the public mirror's normal state) resolves the check to a trivial pass rather than an error — `ops/release-mirror.js` itself refuses outright on an absent data file, a stricter rule than the check's own fail-open reading (see the ADR). The false-positive rule (the scan must not fire on this repo's own documented credential-shape regexes) is a structural proof with a self-test that runs on every invocation, not a path allowlist — see the ADR for why a path allowlist was rejected.

## Recommended companion MCPs (optional)

Two MIT-licensed external MCPs make the loop richer. Neither is required — the skills call them opportunistically and fall back to plain `grep` / `ls` / no-op when the tool namespace is missing. **Code-graph failures never block a loop:** the `/work-issue` pre-flight distinguishes three non-blocking states — namespace absent, project unknown, and tool inconsistent (e.g. `list_projects` finds the project while `index_status` / `detect_changes` report "not found") — and in all three it skips the freshness check (noting the skip in the stage comment) and continues on grep-based discovery.

- **[codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)** — local code-graph MCP (tree-sitter based). Used by `/init-agents` for architecture / conventions defaults, `/create-issue` for files-to-touch suggestions, and `/work-issue` in the Validator / Implementer / Critic stages for code-graph-backed evidence.
- **[MemPalace](https://github.com/MemPalace/mempalace)** — verbatim knowledge-store MCP. The `/work-issue` Closer stage persists a loop summary (repo, PR, commit, Tester findings) as a "drawer" so future sessions can search prior decisions.

## Full pipeline at a glance

```
Bootstrap (once per repo)   Genesis          Planning        Execution
       │                       │                │                │
       ▼                       ▼                ▼                ▼
  /init-agents   →   /create-issue   →   /plan-issues   →   /work-issue
  (AGENTS.md)      (GitHub issues     (work-list, area/  (5 stages →
                    + area label)      bundle labels,     merged PR
                                       start-time report)  + deploy)
```

## Roadmap

See the repo issues (labelled `roadmap`) for the rolling roadmap.

## License

MIT — see [LICENSE](LICENSE).

## Status

Alpha. In active development. Under `0.x` the API may shift between minor bumps — see `AGENTS.md` `version_policy` for the exact patch / minor / major definition. The current version lives only in `.claude-plugin/plugin.json`.

## Optional feature: Visual Reviewer Gate (`visual:` block in AGENTS.md)

An **opt-in** AGENTS.md YAML frontmatter block that adds a sixth crew role — a **Visual Reviewer** — to the loop. When set, `/work-issue` runs a stage (3.5, between Tester and Critic) that serves the built frontend and inspects it with Playwright: for each declared route × viewport (mobile first) it navigates, screenshots, snapshots the a11y tree, and reads the console, then posts `## [stage:visual] PASS|FAIL` with the screenshots attached. A FAIL routes back to the Implementer under the shared 3-revise cap.

It is a **gate, not a loop-type**: frontend work still ships a code diff and keeps the `code` pipeline; the visual review layers on top, on the same axis as `components:`. Fires only when the repo has a `visual:` block AND the issue is frontend-scoped. Absent block → zero behavior change. Schema and enforcement in `AGENTS.md` under "Visual Reviewer Gate"; rationale in `docs/adr/0002-visual-gate.md`.

### Companion MCP: Playwright (optional)

The Visual Reviewer needs the **Playwright** MCP (`mcp__playwright__*`) to drive the browser. Like codebase-memory and MemPalace it is opportunistic: when the namespace is absent the stage is skipped with a note — never a hard fail.
