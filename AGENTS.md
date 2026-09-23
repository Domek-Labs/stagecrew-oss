---
work-issue:
  branch_pattern: "feature/<short>"
  default_branch: dev
  pr_base: dev
  commit_format: conventional
  syntax_check: "node checks/run.js"       # the structural check layer — how to run and extend it: CONTRIBUTING.md
  smoke_test: "true"
  deploy_command: ""
  linter: ""
  docs_command: ""                           # keine abgeleitete Doku: Markdown-Skills, nichts, was sich aus dem Repo erzeugen liesse

  # Per-stage identity for every commit the loop makes, so attribution never
  # depends on the container's session default. The squash-merge co-author
  # caveat this interacts with — both trailer causes, the narrowed gate scope,
  # and why removing this field is not a fix — is canonical in
  # skills/github/SKILL.md §3 and §5 (see #104).
  commit_identity:
    name: "Dominik Scheinecker"
    email: "269312923+domek-at@users.noreply.github.com"

  # test_globs is declared absent, on purpose, not left unset by oversight: this
  # repo is Markdown-only and smoke_test above is the no-op "true", so on the
  # diffs where the /work-issue execution-evidence procedure (skills/work-issue/
  # SKILL.md, "Execution evidence" §1) runs at all, it resolves `applicable:
  # false` regardless of what test_globs would name — there is no executable
  # test run for the revert check to matter against. (A diff confined to
  # `**.md` bypasses the whole procedure earlier, via the docs-only skip rule
  # — see "Execution evidence", "Docs-only bypass"; §1 is what a diff touching
  # e.g. `.claude-plugin/plugin.json`, like a version bump, still reaches.)
  # Setting test_globs here would document a glob pattern nothing ever reads.

  # Declaration, not advice: the canonical per-stage recommendation and the preset
  # definitions live in skills/init-agents/references/model-presets.md. These are
  # this repo's chosen values, the same way any consumer repo declares its own.
  # Preset: economy — sonnet everywhere except the Critic, which stays on opus
  # because it is the gate.
  models:
    validator:   sonnet
    implementer: sonnet
    tester:      sonnet
    visual:      sonnet
    critic:      opus
    closer:      sonnet
  # Declarative only until the dispatch carries an effort parameter — see
  # docs/adr/0017-per-stage-effort-axis.md.
  effort:
    validator:   low
    implementer: high
    tester:      low
    visual:      low
    critic:      high
    closer:      low
  hard_gates:
    - "No direct edits on main"
    - "No new secrets in repo"
    - "SKILL.md requires YAML frontmatter with name and description; model and allowed-tools are optional"
    - "Plugin cache reload (claude restart) after SKILL.md changes — otherwise stale version stays active"
    - "On version bump, .claude-plugin/plugin.json must stay in sync with the plugin cache path"
    - "Version bump follows version_policy (patch / minor / major) — see version_policy field"
    - "English-only for all new writes: issue titles and bodies, PR titles and bodies, commit messages, code comments, and docs. Repo went public on 2026-07-01. Existing German content is left in place until it is re-touched; every new write is English."
    - "Single source for advice: a recommendation table, preset definition, default mapping or convention (any rule a stage must obey) has exactly one canonical file; every other mention links to it rather than restating it, in prose or in values. For per-stage model and effort advice that file is skills/init-agents/references/model-presets.md; for the git/gh interaction conventions it is skills/github/SKILL.md. The only permitted duplicate is a copy artifact (a *.template file), which must be named as such at the canonical source and in this AGENTS.md; a placeholder filled from the canonical file at render time is transclusion, not a copy. Drift test: a mention is a copy if it would have to change when the advice changes; a mention that stays correct whatever the advice says is not."
  default_oos:
    - "No code generation (this repo is Markdown-only)"
    - "No migration of older skill versions without explicit user approval"
  ac_templates:
    - "CLAUDE.md at the repo root reflects the change"
    - "SKILL.md has valid YAML frontmatter"
    - ".claude-plugin/plugin.json is consistent (version, name)"
    - "If plugin.json version changed, the bump matches version_policy and no other file names an explicit version number"
    - "No recommendation table, preset definition, default mapping or convention is restated outside its canonical file (pointer only)"
plan-issues:
  # Contract for area: and bundle: — grammar, lifetime, sources, and what an
  # unlisted value does — is canonical in skills/plan-issues/SKILL.md,
  # "Label contract". This block declares nothing but this repo's vocabulary.
  # The list carries the areas actually in use; extend it when a new one is
  # assigned rather than pre-declaring guesses.
  areas: ["quality", "docs"]
  # The goal axis this repo already carries as target:v1 on its open issues.
  # Grammar, cardinality, the work-list query and the check-question are
  # canonical in skills/plan-issues/SKILL.md, "Label contract — goal: and
  # waiting-on: (canonical)" — declared here, not restated. No label rename:
  # target: stays target:, this only teaches the contract to read it.
  goal_prefix: "target:"
  waiting_prefix: "waiting-on:"
  goals: ["v1"]
strategy:
  # Optional opt-in block; absent = zero behavior change. Shape and opt-in
  # semantics are described in the body section "Strategic Software Development
  # (optional strategy: block)" below — the single canonical home. feature_axis
  # and gates: are read by /create-issue, /work-issue and /plan-issues, and
  # /init-agents offers the block itself in its interactive and --refine dialogs.
  feature_axis:
    prefix: "feature:"
    require_on: [enhancement]
    flag_over: 10
  design_docs:
    prd: ""          # declared: no separate PRD — the strategic essence is in this file's body
    sdd: ""          # declared: no separate SDD — same reason
  gates:
    architecture_adr: true    # every behavior/architecture change ships an ADR under docs/adr/
    component_reuse: false    # no components: block here (Markdown-only repo — nothing to reuse)
    test_evidence: true       # ac_templates carry the evidence here — smoke_test is "true", a declared no-op
    documentation: false      # docs_command is "" — this repo has no derived docs
version_policy:
  # Single source of truth for the version is .claude-plugin/plugin.json.
  # No other file in the repo (README, CLAUDE.md, AGENTS.md body, SKILL.md,
  # subagent-briefs, templates) may name an explicit vX.Y.Z number. Roadmap
  # sections describe *what* is planned, never *when* (no version-tagged
  # milestones). This keeps the version drift-free.
  source_of_truth: ".claude-plugin/plugin.json"
  scheme: semver
  # Current status is 0.x (Alpha). Under 0.x the usual semver rules are
  # inverted for the leading zero: minor bumps *may* be breaking, patch bumps
  # *should not* be. Explicit rules per bump type:
  patch: |
    Wording, typos, formatting, README/CLAUDE polish, non-behavioral internal
    docs, adding examples without changing skill logic, dependency-free chores.
    Everything the plugin's runtime behavior does NOT depend on.
  minor: |
    New skill, new loop-type, new subagent-brief, new AGENTS.md field, changed
    skill behavior that stays backwards-compatible for existing AGENTS.md
    files, new required frontmatter field with a safe default. Under 0.x this
    is the "normal feature" bump and MAY break edge-case setups. Under 0.x a
    deliberate, documented default flip of an existing behavior (a breaking
    default change) ALSO ships as minor, provided (a) the flip is recorded in
    an ADR under docs/adr/ and (b) the old behavior stays available as an
    explicit opt-in (the migration path). The leading zero is the compat
    signal; 1.0.0 remains gated on first_stable_bump.
  major: |
    Removed skill, removed loop-type, removed AGENTS.md field, changed default
    behavior of a skill in a way that breaks callers WITHOUT the documented
    ADR + opt-in migration path that the minor rule requires, hard schema
    migration required. Under 0.x there is no major bump: the leading zero is
    the compat signal, and moving it (0.x -> 1.0.0) is reserved for
    first_stable_bump — it never signals a breaking change. A breaking change
    that fails the minor rule's ADR + opt-in test is therefore not shippable
    as-is under 0.x: add the ADR and the opt-in to make it a legal minor, or —
    where an opt-in is genuinely impossible (e.g. a removed skill) — record
    that impossibility in the ADR and ship as minor. From 1.0.0 on, the rules
    above apply as written.
  first_stable_bump: |
    Move from 0.x to 1.0.0 only when: (a) the 5-stage skeleton has been
    stable for 3+ months without a major bump, (b) all shipped skills have
    at least one battle-tested end-to-end run per loop-type, (c) the AGENTS.md
    schema has a documented compat guarantee.
loop_types:
  enabled: [code, research]
  default: code
  type_overrides:
    research:
      ac_templates: []
      smoke_test: "true"
    # Additional loop types (text / decision / diagnostic) are on the roadmap
    # — see repo issues labelled `roadmap` + `loop-type`. Version-tagged
    # milestones are intentionally NOT listed here (see version_policy).
---

# Agent Instructions for stagecrew

Per-repo coding-standards spec for AI-assisted workflows. Single source of truth for this plugin repo itself (dogfooding — we use `/work-issue` to evolve `/work-issue`).

## Purpose and success metrics

### Purpose

Every loop this plugin runs must yield a **correctly implemented change**. Concretely, the change is

1. **correctly specified**,
2. **built by reusing existing components** rather than re-implementing them,
3. **sensibly scoped**,
4. **documented**,
5. **tested**, with the existing tests extended accordingly,
6. **deployed**,

and across all six, **project-wide overview is maintained** through the `/plan-issues` label axes — the goal axis, `area:`, `bundle:` and `feature:`, whose contracts are canonical in `skills/plan-issues/SKILL.md`.

Every other section of this file exists in service of one of those. This section is the standard they are judged against; it sets no target for any of them.

**Why the statement lives here.** `strategy.design_docs.prd` and `sdd` are both `""` — declared: this repo has no separate PRD or SDD, because a reconstructed design document is a second version of the truth (rationale: `docs/adr/0010-init-agents-design-docs.md`). `/init-agents` fills a purpose-and-non-goals section **only on the no-design-docs path**, and off that path the section keeps its placeholder like any unanswered one — canonical in `skills/init-agents/SKILL.md`, "Optional block: `strategy:`". That path is exactly this repo's path by its own declaration, and this repo, which dogfoods the skill, had no such section until now.

**Non-goals.**

- **Not a code generator.** The product is Markdown; the one exception and the condition that would reverse it are stated under "Code Style / Conventions" and in `docs/adr/0015-structural-check-layer.md`.
- **Not a standards library.** The plugin is a pure reader: what a stage must obey comes from the target repo's `AGENTS.md`, never from the plugin. Shipping opinionated defaults into consuming repos is not a goal.
- **No second design document.** Strategic content belongs in this body, which every stage already loads (`docs/adr/0010-init-agents-design-docs.md`).
- **No measurement machinery for the numbers below.** They are definitions plus a dated observation; nothing branches on them, and no script, check, dashboard or frontmatter field is introduced to produce them. Where an issue would automate one, the issue is named in the row.

### Success metrics

**Precondition, stated once.** Almost every diagnostic below reads a `[stage:*]` comment, which the loop writes about itself, so the number measures what a stage *said*, not what it *did*. **#81** (golden cases — verify loop verdicts against a disposable fixture repo) is the open trust gate, and **#70** (a failure-attribution line on every FAIL/REVISE) is what makes a dropped number attributable to a stage rather than merely visible. **#80 has shipped and does not lift this**: `docs/adr/0015-structural-check-layer.md` states the layer's own boundary — it catches structural drift only and does not read prose for meaning, so it cannot judge whether a stage comment is truthful. What it did buy is the one independent source this repo has today: GitHub's `actions/runs`, produced by GitHub rather than by the stage being measured.

**Headline — rework rate.** The share of merged loops that needed a later correction to the same change. It is the only outcome-based number here: a loop cannot improve it by grading itself more generously. **Source:** git history plus the issue/PR link graph. **State: gated on #66** (record which error class a loop addresses), which is what makes it derivable rather than hand-reconstructed. Today it is **unmeasured** — no run has been classified — and it is recorded as unmeasured, not as zero.

**Diagnostics — one per part.** Every row names its data source and one of three states: *measurable today*, *not applicable here*, or *gated on* a named issue.

| Purpose part | Diagnostic | Data source | State |
|---|---|---|---|
| 1. correctly specified | Validator STOP rate on the first pass — a rate near zero means the gate is a rubber stamp, a high rate means `/create-issue` under-specifies; both are failures | `[stage:validator]` comments on the issue thread | **measurable today**, self-reported (#81); sharpened by #68, which requires a Test Plan to name an execution path |
| 2. existing components reused | dupe findings per loop, against a declared `components:` registry | `[stage:critic]` comments compared against a `components:` block — this repo declares none, and `strategy.gates.component_reuse` is `false` | **not applicable here** — Markdown-only repo, nothing to reuse. The diagnostic lives in downstream repos that declare a registry; no proxy is invented for this one |
| 3. sensibly scoped | revise cycles per loop, and the files actually changed versus the issue's declared `Files to Touch` | stage comments (cycle count) plus the PR diff read against the issue body (file set) | **measurable today**; the cycle count is self-reported (#81), the diff half is not |
| 4. documented | share of merged loops carrying a behaviour or architecture change that shipped an ADR under `docs/adr/`, where `strategy.gates.architecture_adr` is `true` | `docs/adr/` history versus merged PRs | **measurable today**; completeness is bounded by **#131** — a statement falsified inside a file the diff itself touches is structurally invisible to the Critic's out-of-diff falsification check (`docs/adr/0011-out-of-diff-falsification-check.md`) |
| 5. tested, tests extended | share of loops whose Tester produced a base-versus-branch comparison rather than a claim | `[stage:tester]` comments | **gated on #65** — today a Tester can assert that tests pass with nothing behind it. Partially covered already: `syntax_check` also runs in CI, and that result comes from `actions/runs` |
| 6. deployed | completion rate — loops reaching the `merged` terminal verdict over loops claimed | `[stage:closer]` terminal verdicts and issue close events, cross-checked against `actions/runs` | **measurable today**, and the cross-check is independent of the stage being measured |
| overview via the label axes | label completeness per axis actually in use | `gh issue list --state open --json number,labels` | **measurable today** — baseline below |
| cost (cross-cutting) | loop wallclock, `## [claim]` to `## [stage:closer]`, both server-timestamped; plus CI duration per run | issue-thread timestamps — method and the recorded series in `docs/adr/0020-split-time-budgets.md` — plus `actions/runs` | **measurable today**, and non-self-reported. **No token or spend record exists anywhere in this repo**: wallclock and CI duration are the whole of the cost evidence available, and a token metric would be a wish |

### Baseline — measured 2026-09-04 on `dev` @ `d1915a0`

Command: `gh issue list --state open --limit 200 --json number,labels`, counted per label prefix; `feature:` coverage restricted to issues carrying `enhancement`.

| Axis | Value |
|---|---|
| open issues | 25 |
| carrying `waiting-on:*` | 7 → actionable work-list of **18** |
| `loop-type:` | 25/25 (100 %) |
| goal axis, `target:` | 25/25 (100 %) |
| `area:` | 8/25 (32 %) |
| `feature:` on `enhancement` issues | 1/9 (11 %) |
| `feature:` overall | 4/25 |
| `bundle:` | 2/25 |
| rework rate | unmeasured — no run has been classified |

What this baseline **records rather than fixes**:

- **The goal axis in active use was undeclared at the baseline.** `target:v1` is this repo's goal axis, and on 2026-09-04 the `plan-issues:` block above did not yet declare it. Since #134 the block declares `goal_prefix: "target:"`, `waiting_prefix: "waiting-on:"` and `goals: ["v1"]` alongside `areas:`, which is what makes the goal question in `/create-issue`'s dialog fire here (behaviour canonical in `skills/create-issue/SKILL.md`). An open issue carrying no goal label stays goal-less by design, not by omission.
- **`feature:` is being adopted, not ignored.** 11 % satisfies `strategy.feature_axis.require_on: [enhancement]` poorly, but every one of the four `feature:` labels carried by an open issue was applied between 2026-09-01 and the measurement date. The level is low and the direction is upward; both belong in the reading.
- **Neither `wallclock_cap_min` nor `ci_poll_cap_min` is declared in this repo's own frontmatter**, although both fields exist; each therefore resolves to its own default (`docs/adr/0020-split-time-budgets.md`).

No target or threshold is set for any number above. This section records what is measured, from where, and where it stood on the date named — what a number ought to be is a separate decision.

## Architecture

Single-plugin repo for the `stagecrew` Claude Code plugin.

- `.claude-plugin/plugin.json` — plugin manifest (name, version)
- `CLAUDE.md` — plugin documentation
- `README.md` — public-audience tagline + quickstart
- `CONTRIBUTING.md` — how to run and extend the structural check layer
- `checks/` — the structural check layer (zero-dependency Node; `node checks/run.js`)
- `.github/workflows/` — CI; runs the same check layer on push and pull request
- `skills/`
  - `loop/` — umbrella skill (router to init-agents / create-issue / work-issue)
  - `init-agents/` — bootstrap AGENTS.md for a repo
  - `create-issue/` — idea → GitHub issue with spec standard
  - `work-issue/` — issue → reviewed, merged PR (5-stage spec→build loop; the Closer merges in-loop)

## Code Style / Conventions

- **The product is Markdown.** Every skill that ships is Markdown; no skill is written in TS/JS/Python. The one exception is repo-local tooling: the zero-dependency Node check layer under `checks/`, which verifies the repo and is not part of the plugin. Reasoning and the condition that would reverse it: `docs/adr/0015-structural-check-layer.md`.
- SKILL.md **must** carry a YAML frontmatter with the required fields `name` and `description`; `model` and `allowed-tools` are optional. No shipped skill sets `model` — rationale in `docs/adr/0014-skill-frontmatter-model-optional.md`.
- Description field: lowercase, comma-separated trigger words (no inline `Trigger:` prefixes — they break strict YAML).
- Commit format: conventional (`feat(skill): ...`, `fix(create-issue): ...`, `docs: ...`).
- Branch pattern: `feature/<short>` or `fix/<short>`.
- **No inline version numbers.** Only `.claude-plugin/plugin.json` names the current version. All other files describe what a feature does, not when it landed.
- **English-only for new writes.** See the "Language" section below.

## Language

**English-only for all new writes** — issue titles and bodies, PR titles and bodies, commit messages, code comments, docs. The repo went public on 2026-07-01 (PR #16 also landed the version-policy reset alongside the flip); at that point English became the only acceptable target for new content.

Practical rules:

- **Writing new content:** English. Even if the requesting user speaks German. Explain the reasoning briefly if the user asks — the repo is public, so all artifacts have to read to outside contributors.
- **Editing existing content:** if the file is already German (a handful of ADRs, some inline `.md` notes), translate the touched sections to English when you edit them. Leave the untouched sections as they are for now — a bulk German-to-English translation is out of scope for a single loop, but every diff nudges the repo further toward English-only.
- **User conversation stays as the user prefers.** This rule is about *the artifacts that end up in the public repo* (issues, PRs, commits, docs). Chat with the requesting user stays in whatever language they wrote in.
- **Validator responsibility:** the `/work-issue` Validator treats a German issue title or body as a STOP with a hint to `/create-issue --refine` in English, unless the requesting user explicitly opts out for a specific issue via the `## Standards Override` block.

## Loop Types

This skill set supports multiple issue types:
- **`code`** (default) — software implementation tasks
- **`research`** — knowledge generation with a test matrix

Battle-tested in an internal bot project — code loops (13 PRs, 2026-06-26) and research loops (first end-to-end run, 2026-06-26).

Roadmap for `text`, `decision`, `diagnostic` types — see repo issues with labels `roadmap` + `loop-type`.

## Hard-Gates Detail

1. **No direct edits on the default branch (dev)** — PR flow mandatory. (Branch protection is unavailable on this private repo without GitHub Pro; the PR flow is the enforced convention.)
2. **No new secrets in repo** — the repo is public; a leaked token would be publicly indexed within minutes.
3. **SKILL.md YAML frontmatter** — the loader is tolerant but strict-YAML compliance is mandatory (otherwise CI breaks against future validator tooling).
4. **Plugin cache reload after skill changes** — `claude restart` is mandatory in every PR body.
5. **plugin.json version bump in sync** — the plugin cache path uses the version, so an asynchronous bump leaves a stale cache.
6. **Version bump follows version_policy** — see the `version_policy` field in the YAML frontmatter. No other file may name an explicit version number; when in doubt, ship as `patch`.
7. **English-only for new writes** — see the `Language` section above. The Validator STOPs on a German issue title or body unless the issue's `## Standards Override` block explicitly waives this gate.
8. **Single source for advice** — a recommendation table, preset definition, default mapping **or convention** has exactly one canonical file; every other mention links to it rather than restating it, **in prose or in values**. For per-stage model and effort advice that file is `skills/init-agents/references/model-presets.md`; for the `area:` / `bundle:` issue-label contract it is `skills/plan-issues/SKILL.md`; for the **git/gh interaction conventions** (commit author identity, `no_unconfigured_coauthors`, read-only-`.git` → `gh`, PR-body conventions, the squash-merge co-author caveat, non-interactive shell) it is **`skills/github/SKILL.md`**. A Validator reading a diff must ask "does the surrounding sentence recommend, or bind?" — not "does it look like schema". A recommended value carried with its reasoning is a recommendation even inside a YAML block; an alias enumeration (`opus | sonnet | haiku | fable`) or an effort-level enumeration (`low | medium | high | xhigh | max`) is not.

   **"Convention" is in scope, explicitly.** The enumeration once named only a recommendation table, a preset definition and a default mapping, and a *rule a stage must obey* fitted none of those three labels. That omission is why the git/gh conventions were restated in seven files for as long as they were: nobody classified them as advice, so the gate never looked at them. Any rule a stage must obey — an instruction in a briefing, a hard-gate's meaning, a procedure a stage runs — has one canonical file, the same as advice does. A *gate name* in a `hard_gates` list is not a copy of the rule behind it; the sentence explaining what the gate forbids is.

   **Transclusion is not duplication.** A placeholder that the render step fills from the canonical text at dispatch time — `{{git_conventions}}` in the briefings that commit, `{{delegation_rule}}` in every briefing that can spawn a subagent (see `skills/work-issue/SKILL.md`, "Transcluded git/gh conventions" and "Transcluded delegation rule") — holds **no text of its own** and cannot drift. Those files are transclusion consumers, **not** copy artifacts, and they are deliberately absent from the enumeration below. Prefer transclusion wherever the consumer is rendered; a copy artifact is only for a file that nothing renders.

   **Permitted copy artifacts — five, all in `skills/init-agents/references/AGENTS.md.template`**, each named as such at its canonical source and here, because a template is read standalone by a human in a foreign repo where no path resolves back into this plugin:
   - the commented `models:` values (advice — canonical in `skills/init-agents/references/model-presets.md`),
   - the commented `effort:` values (advice — canonical in the same file, and updated in the same PR as the `models:` values),
   - the commented `plan-issues:` block (advice — canonical in `skills/plan-issues/SKILL.md`),
   - the commented `strategy:` block (advice — canonical in this file, "Strategic Software Development"),
   - the git/gh convention comments — the `never a company/shared email` note beside `commit_identity` and the `no_unconfigured_coauthors` note beside `hard_gates` (**convention** — canonical in `skills/github/SKILL.md` §2, §3, §5). This last one is a copy of a *convention*, and it is enumerable here only because this gate's wording now reaches that class. Two of the four advice copies moved with the release that added the `effort:` entry — the `models:` values (the recommended implementer tier) and the new `effort:` values; the `plan-issues:` and `strategy:` copies are unchanged. Nothing renders the template, so transclusion is not available to it.

   **Drift test** (mechanical, use it when the surrounding-sentence test needs judgment): a mention is a copy if it would have to change when the advice or the convention changes. A mention that stays correct whatever it says — an alias enumeration, a placeholder shape, an audit-line format example such as `model: fable`, a bare gate name in a list — is not a copy, however closely it happens to resemble the current text. Update-coupling makes a copy; coincidence does not. A **count** is a copy of the list it counts — "the 13th field", "the three skills above" — because it must change whenever the list does, and, unlike a renamed value, it leaves no search term behind for a `grep` to catch.

## Plugin-Loader Gotchas

- Cache path: `~/.claude/plugins/cache/stagecrew/<version>/skills/<name>/SKILL.md`
- Marketplace source: can be a local path (development) or a GitHub URL (public production)
- On a `plugin.json` version bump, the old cache path stays and a new path is created — `claude restart` is required.

## Environment / Tooling Gotchas

`/work-issue`'s pre-flight now probes the external commands the shipped skills' instructions
actually invoke and reports once — never a STOP, with one named exception. **Not restated here**:
the tool list, its derivation-by-search, the `python3` → `node` → structural-scan YAML-
parseability fallback chain, and the concrete ugrep failure (a container's default `grep`
silently missing a match a backtracking engine would find, first measured in #106) are all
canonical in **`skills/work-issue/references/tool-requirements.md`**. Read that file; do not
reconstruct any of it from memory or from this pointer.

## Issue labels: `area:` and `bundle:` (optional `plan-issues:` field)

Two issue labels record two stable facts about an issue that nothing else in the label set captures: **what an issue is about** (`area:<name>`) and **what it ships with** (`bundle:<name>`). A repo may declare its area vocabulary in an optional `plan-issues:` frontmatter block; absent block = every value accepted, zero behavior change, and no pre-flight consequence.

**The contract is not restated here — deliberately.** Grammar, lifetime, the three legal sources for each label, and what an unknown area does are canonical in **`skills/plan-issues/SKILL.md`, section "Label contract — `area:` and `bundle:` (canonical)"**. `/plan-issues` is the producer, which is why the contract lives with it.

The commented `plan-issues:` block in `skills/init-agents/references/AGENTS.md.template` is a **copy artifact** — one of the duplicates hard-gate 8 permits, because a template must be readable standalone. It is named as such at the canonical source too, and the two change together.

### For this repo

This repo declares a `plan-issues:` block carrying four fields: `areas: ["quality", "docs"]` — the two values actually assigned (`area:quality`, `area:docs`), with no third value in use — plus `goal_prefix: "target:"`, `waiting_prefix: "waiting-on:"` and `goals: ["v1"]`, declaring the goal axis this repo already carries as `target:v1` on its open issues (schema canonical in `skills/plan-issues/SKILL.md`). `goal_default:` is the one field of that schema still undeclared — it is optional and has no default, so no goal is offered first in the single-select (contract canonical in `skills/plan-issues/SKILL.md`). `bundle:` has no field to declare at all: a bundle name comes from the issue or from the human, never from a vocabulary (`skills/plan-issues/SKILL.md`, "`bundle:` is never invented").

## Component Registry (optional AGENTS.md field)

Component drift across sessions and users is a real cost: the same UI concept (a data table, a navigation menu) gets re-implemented slightly differently every time an issue lands. When a decision changes ("from now on: tabs, not submenus"), a 20-file refactor becomes the cheapest exit — because there was never one canonical component to change. The same trap exists on the backend for domain entities, value objects and query handlers.

The loop can prevent this if a repo declares an **optional `components:` block** in the AGENTS.md YAML frontmatter. Absent block = zero behavior change. Opt-in per Pure-Reader principle.

### Schema

```yaml
components:
  registry_path: "docs/components.md"           # required if block present — the Markdown catalog
  code_globs:                                   # required — points at the code source-of-truth
    - "src/components/**/*.tsx"
    - "src/domain/**/*.ts"
  usage_policy: "prefer_existing"               # prefer_existing (soft, warns) | strict (hard, ADR required for new)
  scope: "both"                                 # frontend | backend | both (default both)
```

### Two layers

1. **Code layer** — the real reusable components in the codebase (single source of truth for API / props / types / backend contract). Referenced via `code_globs`.
2. **Markdown catalog layer** — a per-component MD (rooted at `registry_path`) describing when to use, when not to, where the code lives, the public API summary, the backend contract shape (if applicable), and anti-patterns.

### Registry MD structure (per component)

- Name
- Purpose (when to use, when not to)
- Code path (link into `code_globs`, the source of truth)
- Public API summary
- Backend contract shape (if applicable — e.g. table filter/sort response shape)
- Anti-patterns

A skeleton template with a worked frontend example and a worked backend example ships in `skills/init-agents/references/components-registry-template.md`.

### `usage_policy` modes

- **`prefer_existing`** (default when block present, soft): the Validator warns if an in-scope issue does not reference an existing registry component; the Critic still runs dupe detection. Non-blocking.
- **`strict`** (hard): the Validator STOPs an in-scope issue unless it references an existing registry component OR links an ADR path in the `## Standards Override` block that justifies adding a new one. Implementer + Critic keep the same hard-gate.

### `scope` values

- **`frontend`** — enforcement applies only to `code_globs` matching frontend patterns.
- **`backend`** — enforcement applies only to backend patterns (domain entities, value objects, aggregates).
- **`both`** (default) — enforcement applies to any file in `code_globs`.

### Loop integration

- **Validator (stage 1):** if the issue's `Spec` or `Files to Touch` implies work in the `code_globs` scope, gate as above (warn in `prefer_existing`, STOP + ADR requirement in `strict`).
- **Implementer brief:** hard-gate — "If a registry component fits the case, use it. Do not inline a duplicate. If nothing fits, stop and propose an ADR before implementing."
- **Critic (stage 4):** dupe-detection pass — `search_code` / grep across `code_globs` for repeated patterns; if two implementations cover the same concept, log as a REVISE item.

### For this repo

This repo is **Markdown-only** — no frontend framework, no backend domain layer, no `code_globs` scope. The `components:` block is therefore not set here. This section documents the schema so `/init-agents`, `/create-issue` and `/work-issue` can honor it in downstream target repos.

## Visual Reviewer Gate (optional AGENTS.md field)

Frontend issues pass the loop on a green build alone — nobody looks at the rendered UI. A build can succeed while the page overflows on mobile, pushes a primary action below the fold, or throws a console error no unit test catches. The loop can close that gap if a repo declares an **optional `visual:` block** in the AGENTS.md YAML frontmatter. Absent block = zero behavior change. Opt-in per the Pure-Reader principle.

This is a **gate, not a loop-type**. Frontend work still ships a code diff, so it keeps the `code` implementer / Tester / Critic / Closer — the visual review is an extra stage layered on the same axis as `components:`, not a fork of the code pipeline. Design rationale in `docs/adr/0002-visual-gate.md`.

### Schema

```yaml
visual:
  serve_command: "npm run preview"     # required if block present — how to serve the built frontend
  base_url: "http://localhost:4173"    # required — where the served app answers
  viewports:                           # optional; default [390x844 mobile, 1280x800 desktop]
    - { w: 390,  h: 844,  label: mobile }
    - { w: 1280, h: 800,  label: desktop }
  routes: ["/"]                        # optional default routes; the issue can override/extend
  console_error_policy: "fail"         # fail | warn (default fail)
  screenshot_dir: ".stagecrew/visual"  # optional — where screenshots are saved before upload
  scope: "frontend"                    # visual review only applies to frontend work
```

### Trigger

The Visual Reviewer stage fires only when **both** hold: the repo has a `visual:` block, and the issue is frontend-scoped (files-to-touch match a frontend glob OR the Spec/AC contain a frontend keyword: `page`, `route`, `UI`, `component`, `layout`, `responsive`, `screen`, `viewport`). Otherwise it is skipped silently.

### Loop integration

- **`/create-issue`** injects a `### Visual Acceptance (AGENTS.md visual:)` AC block for in-scope issues.
- **`/work-issue` stage 3.5 (Visual Reviewer)** — between Tester and Critic — serves the built frontend, drives Playwright per route × viewport (mobile first), captures screenshots + a11y snapshots + console output, and posts `## [stage:visual] PASS|FAIL` with screenshots attached. FAIL routes back to the Implementer under the shared 3-revise cap.
- Requires the Playwright companion MCP; absent namespace → the stage is skipped with a note, never a hard fail.

### For this repo

This repo is **Markdown-only** — no frontend, no `serve_command`. The `visual:` block is therefore not set here. This section documents the schema so `/init-agents`, `/create-issue` and `/work-issue` honor it in downstream frontend repos.

## Model Selection (optional AGENTS.md fields: `models:` and `effort:`)

Every stage of `/work-issue` runs on whatever model happens to be active in the caller's session. That is wrong in both directions at once: the Critic — the gate that decides APPROVE vs. REVISE — runs on the same model as the Closer, which only opens a PR, merges it, and deletes a branch. A weak Critic waves through unverified claims; a strong Closer burns tokens on `gh` calls.

The loop already knows its own stage semantics, so it can carry the model decision instead of leaving it to session luck. This is an **opt-in AGENTS.md block** — same axis as `components:` and `visual:`: absent block = zero behavior change.

The same argument applies to **reasoning effort**, the other half of the control surface: a Closer running a fixed command sequence does not need the thoroughness a Critic adjudicating a diff does. `effort:` is therefore a **second axis on the same mechanism**, not a second mechanism: same shape, same six stage keys, same three resolution tiers, same prefer-and-degrade failure posture, same audit line. One caveat, stated plainly here and in full in `skills/work-issue/SKILL.md` ("Per-stage model and effort dispatch"): **the current subagent dispatch carries a model parameter and no effort parameter**, so `effort:` is resolved and recorded as *requested* and does not yet change how a stage runs. Setting it today buys an intent record. See `docs/adr/0017-per-stage-effort-axis.md`.

### Schema

```yaml
work-issue:
  models:                # optional; absent = every stage inherits the session model
    validator:   <alias>            # opus | sonnet | haiku | fable
    implementer: <alias>
    tester:      <alias>
    visual:      <alias>            # only used when the visual: gate fires; unused otherwise
    critic:      <alias>
    closer:      <alias>
  effort:                # optional; absent = every stage runs at the API/session default effort
    validator:   <level>            # low | medium | high | xhigh | max
    implementer: <level>
    tester:      <level>
    visual:      <level>            # only used when the visual: gate fires; unused otherwise
    critic:      <level>
    closer:      <level>
```

**Rules:**

- **Aliases only** (`opus`, `sonnet`, `haiku`, `fable`). Never a pinned model id. Pinned ids rot on the next model release.
- **Absent block = inherit** the caller's session model for every stage. Zero behavior change for existing AGENTS.md files.
- **Partial blocks are legal.** Only `critic: opus` set → the Critic is overridden, all other stages inherit. No completeness check.
- `models:` is explicitly **NOT** part of the mandatory 11-field completeness pre-flight in `/work-issue`. A missing block must never STOP.
- **Unknown / unavailable / rejected alias** → fall back to inherit, note it in the stage comment, never STOP. Same posture as the Playwright MCP and the code-graph MCP: prefer-and-degrade.
- **`models.visual`** is cached but unused when the `visual:` block is absent or the issue is not frontend-scoped. A model preference must never cause the Visual Reviewer stage to run.

**The same five rules bind `effort:`**, with the vocabulary swapped: **levels only** (`low`, `medium`, `high`, `xhigh`, `max`); absent block = the API/session default for every stage; partial blocks legal; not part of the 11-field completeness pre-flight; an unknown level, or a model that does not accept the level, falls back to the default, is noted in the stage comment and never STOPs; `effort.visual` is cached but never causes the Visual Reviewer stage to run. The two axes fall back independently — a rejected level does not disturb an accepted alias.

### Recommended mapping

The recommended per-stage mapping on **both** axes, the per-stage reasoning, the `code` vs `research` implementer
split, the four preset definitions and the four preset effort blocks are in one canonical file:
**`skills/init-agents/references/model-presets.md`**

`/init-agents` reads that file when writing or updating a repo's `models:` and `effort:` blocks.
`/work-issue` does **not** read it — at loop time the only source is the target repo's AGENTS.md.
No model alias and no effort level is a default anywhere in the skills; both are read from the
target repo's AGENTS.md or from nowhere.

The literal commented-out values in `skills/init-agents/references/AGENTS.md.template` are a
**deliberate duplication**: a copy artifact cannot contain a pointer in place of the values it
provides. Both files must be updated together whenever the recommendation changes — on either axis.

### `code` vs `research` split

The `code` vs `research` implementer split — why a research loop wants a stronger Implementer, and the `loop_types.type_overrides` YAML that sets it — is in `skills/init-agents/references/model-presets.md`.

Resolution order: `work-issue.models.<stage>` (base) → `loop_types.type_overrides.<loop_type>.models.<stage>` (type layer, both are L1) → a `models.<stage>` key **nested under `work-issue:`** in the issue's `## Standards Override` block (L2, consistent with every other overridable field) → inherit.

`effort:` resolves identically at every tier — `work-issue.effort.<stage>` → `loop_types.type_overrides.<loop_type>.effort.<stage>` → an `effort.<stage>` key nested under `work-issue:` in the override block → the API/session default. A top-level `models:` or `effort:` in the override block (not nested) is not read.

An unrecognised stage key (e.g. `models.reviewer: opus`, `effort.reviewer: low`) is ignored with a note in the loop output — never a STOP.

### Loop integration

- **Pre-flight (stage 0):** if present, the `models:` and `effort:` blocks are cached alongside `components:` and `visual:`. Absent block → cached as `null`; every stage inherits the session model and runs at the default effort.
- **Stage dispatch:** before spawning each stage's subagent, the skill resolves the model alias per the resolution order and passes it as the `model:` parameter. No resolved value → spawn without a model parameter (inherit, not a hardcoded fallback). The resolved **effort level is not passed** — the dispatch has no such parameter; the canonical statement of that gap, and of what would change when it closes, is in `skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch".
- **Auditability:** each `[stage:<name>]` comment ends with one audit line naming the model that ran and the effort that was requested. The exact grammar and every rendered form are canonical in `skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch" — not restated here.
- **Nested subagents:** what a nested spawn inherits on either axis, when one is warranted at all, and what a stage records about it are **one rule with one canonical home** — the delimited `delegation_rule` block in `skills/work-issue/SKILL.md`, transcluded into every stage briefing that can spawn. Not restated here; rationale in `docs/adr/0021-delegation-rule-and-spawn-visibility.md`.

### Retrofit via `/init-agents --models`

Existing repos add both blocks without re-running the full init dialog — `--models` writes the `models:` and the `effort:` block together, so a preset sets both axes coherently:

```
/init-agents --models [--repo <slug>]                      # interactive: pick a preset
/init-agents --models --preset balanced [--repo <slug>]    # non-interactive
```

Presets: `balanced`, `economy`, `quality`, `inherit` — definitions and trade-offs, on both axes, in `skills/init-agents/references/model-presets.md`.

`--refine` offers the blocks when absent (as an offer, never an autonomous write) — same posture as the `components:` probe.

### For this repo

This repo uses the `/work-issue` loop to evolve itself (dogfooding). Neither the `models:` nor the `effort:` block is set here — this section documents the schema so downstream repos can adopt it. Design rationale in `docs/adr/0003-model-selection.md` (the model axis, with the default flip recorded in `docs/adr/0018-implementer-model-default.md`) and `docs/adr/0017-per-stage-effort-axis.md` (the effort axis).

## Strategic Software Development (optional `strategy:` block)

**This section is the canonical description of the `strategy:` block.** It documents the block's *shape and opt-in semantics* only. It deliberately does **not** restate the mechanisms the block points at — `components:`, `smoke_test` / `ac_templates`, `docs_command` and the ADR practice each stay canonical where they already are, and are linked from here.

Strategic software development means architecture, planning, documentation, building-block size, component reuse and test evidence are considered **from the ground up** rather than reconstructed afterwards. Every hook for that already exists in this schema, but scattered across four unrelated fields. The optional top-level **`strategy:` block** gives them one coherent, opt-in home. Absent block = zero behavior change, on the same axis as `components:`, `visual:` and `models:`.

### Schema

```yaml
strategy:                        # optional opt-in; absent = zero behavior change
  feature_axis:
    prefix: "feature:"           # configurable, like goal_prefix / waiting_prefix
    require_on: [enhancement]    # issue types that MUST carry a feature: label (once opted in)
    flag_over: 10                # soft: a feature with more open issues is NOTED, never a STOP
  design_docs:                   # optional pointers — set only when a real document exists
    prd: ""                      # path = it exists; "" = decided, none; key absent = not decided yet
    sdd: ""
  gates:                         # switch EXISTING mechanisms to strategically-required
    architecture_adr: true       # → the ADR practice (docs/adr/)
    component_reuse:  true       # → components:                (canonical there)
    test_evidence:    true       # → smoke_test / ac_templates  (canonical there)
    documentation:    true       # → docs_command + this repo's own docs ac_template
```

### Opt-in semantics

- **Absent block = zero behavior change.** Nothing is required, nothing is created, no pre-flight consequence. Same posture as `components:` / `visual:` / `models:`.
- **Partial blocks are legal.** Any of the three sub-blocks may be omitted; only what is declared is read. `strategy:` is explicitly **not** part of `/work-issue`'s mandatory field-completeness pre-flight — a missing block must never STOP.
- **`gates:` values are booleans that switch an existing mechanism from optional to strategically-required.** They add no machinery of their own: a `true` with no underlying mechanism configured (e.g. `component_reuse: true` in a repo with no `components:` block) has nothing to enforce and is reported, never a STOP.
- **A gate never becomes a precondition for the mechanism it points at.** Switching a gate on can only add; it can never withhold behaviour a repo already has. A repo with a `components:` block and no `strategy:` block gets the Component Reuse Check exactly as it always has — the additive relationship is stated at the check itself, in `skills/create-issue/SKILL.md`.
- **`false` is not a third state.** A gate declared `false` behaves exactly like a gate that is not declared at all: nothing is injected and nothing is reported.

**Where each gate's behaviour is canonical** (pointers only — none of it is restated here):

| Concern | Canonical file |
|---|---|
| What each gate injects into an issue's ACs, incl. the ADR Check text and the docs AC-template lookup | `skills/create-issue/SKILL.md`, "Strategic Gates" |
| What "unconfigured" means per gate, and the pre-flight report | `skills/work-issue/SKILL.md`, "Optional `strategy.gates` consistency report" |
| How the gate state appears in a plan | `skills/plan-issues/SKILL.md`, step 9 |
- **`feature_axis.flag_over` is soft by construction.** Crossing it produces a note, never a block — feature *size* is caught at issue level by the epic trigger in `skills/create-issue/SKILL.md`, not by a per-feature issue count.
- **`design_docs` are pointers, not containers**, and the three states are distinct — the same convention `docs_command` uses:

| Value | Means |
|---|---|
| a path | the document exists; here it is |
| `""` | **decided**: this repo has no separate PRD/SDD |
| key absent | **nobody has decided yet** |

  A path here only ever points at a document that genuinely exists: nothing in this plugin scaffolds a PRD or an SDD, because a reconstructed design document is a second version of the truth and drifts unread. With none declared, the strategic essence belongs in this AGENTS.md body, which every stage of every loop already loads. What the bootstrap does with each of the three states — the four questions, the body sections they fill, and the behaviour on a first run versus a `--refine` — is canonical in `skills/init-agents/SKILL.md`, "Optional block: `strategy:`"; rationale in `docs/adr/0010-init-agents-design-docs.md`.

### Where the feature axis lives, and where its label contract lives

`feature_axis` configures a **`feature:` issue-label axis**, and it sits under `strategy:` rather than beside `goals` in the `plan-issues:` namespace. That is a deliberate exception to ADR 0006 §5, and the boundary is:

- **The switch lives here.** The feature axis is part of the strategic framework and is turned on and off with it — a repo that does not do strategic feature decomposition should not carry a half-configured feature vocabulary.
- **The label contract stays there.** Grammar, cardinality, lifetime, legal sources and retirement for `feature:` are canonical in **`skills/plan-issues/SKILL.md`**, section "Label contract — `feature:` (canonical)", beside the `area:` / `bundle:` and `goal:` / `waiting-on:` contracts — one file for every issue-label contract, per hard-gate 8. Nothing about the contract is restated here.

Rationale recorded in `docs/adr/0008-strategy-block.md`; the gates' step from declared intent to effective behaviour in `docs/adr/0009-strategy-gates.md`; the bootstrap that offers the block, and why it consumes design docs rather than scaffolding them, in `docs/adr/0010-init-agents-design-docs.md`.

### Copy artifact

The commented `strategy:` block in `skills/init-agents/references/AGENTS.md.template` is a **copy artifact** — one of the duplicates hard-gate 8 permits, because a template has to be readable standalone. It is named as such there and in hard-gate 8 above, and the two change together.

### For this repo

This repo **declares a `strategy:` block** (see the frontmatter) as the dogfood. `architecture_adr` and `test_evidence` are `true` — both mechanisms are real here. `component_reuse` and `documentation` are `false`: this is a Markdown-only repo with no `components:` block and an empty `docs_command`, so there is nothing for those gates to require.

**What reads this block.** `feature_axis` is live: `/create-issue` asks the feature question (mandatory for the issue types in `require_on`, offered for the rest) and sets the label, and `/plan-issues` groups the work-list by feature and prints the soft `flag_over` note. **`gates:` is live too**: `/create-issue` injects each enabled gate's ACs, `/work-issue`'s pre-flight reports a gate whose mechanism is unconfigured (never a STOP), and `/plan-issues` prints the gate state — each behaviour canonical in the file named in the table above. **`/init-agents` offers the block** in its interactive and `--refine` dialogs (never in `--auto`, never autonomously), consumes an existing PRD/SDD into `design_docs` and otherwise runs its short strategic Q&A into the AGENTS.md body — canonical in `skills/init-agents/SKILL.md`, "Optional block: `strategy:`". Declaring the block creates **no** labels: `feature_axis` has no declared vocabulary to seed from, so a `feature:` label is created on demand by `/create-issue` when a feature is first named, per the contract in `skills/plan-issues/SKILL.md`.

For this repo that means `architecture_adr` now applies to this repo's own loops — a behaviour or architecture change ships an ADR under `docs/adr/` — and `test_evidence` counts as configured through the five `ac_templates`, so it is never reported. `component_reuse` and `documentation` are `false` and do nothing.
