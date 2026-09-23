---
name: init-agents
description: "Create AGENTS.md (per-repo coding-standards spec) for a Git repo. YAML frontmatter carrying the repo's standards fields — its branch, build, test and deploy conventions and its hard_gates — plus a Markdown body (purpose/non-goals, architecture, code conventions, test conventions, known gotchas). Offers the optional plan-issues block (area + goal vocabularies; creates goal:* labels when goals are named) and the optional strategy block (feature axis, design-doc pointers, gates) — design-doc aware: it records an existing PRD/SDD, and otherwise runs a short strategic Q&A into the AGENTS.md body, never into a second document. codebase-memory provides intelligent defaults from the repo cluster. Mandatory bootstrap before the first /work-issue run in a repo. Triggers: /init-agents, init agents, create agents.md, coding spec bootstrap, initialize repo standards."
---

# /init-agents — Create AGENTS.md for a repo

**Type:** bootstrap / standards-spec engineering

## Purpose

AGENTS.md is the **single source of truth** for per-repo coding standards. `/work-issue` is a **pure-reader** (no hardcoded defaults): all standards values come from AGENTS.md at the repo root.

That makes AGENTS.md **mandatory** before `/work-issue` can run against a repo. `/init-agents` creates it — interactively (the user is walked through every field) or autonomously (codebase-memory supplies sensible defaults).

## Invocation variants

```
/init-agents                                              # cwd repo, interactive dialog
/init-agents --repo <slug>                                # specific repo, interactive (default)
/init-agents --repo <slug> --interactive                  # explicit interactive
/init-agents --repo <slug> --auto                         # autonomous with codebase-memory defaults
/init-agents --refine [--repo <slug>]                     # extend an existing AGENTS.md with missing fields
/init-agents --models [--repo <slug>]                     # add / update the models: + effort: blocks (retrofit path)
/init-agents --models --preset <balanced|economy|quality|inherit> [--repo <slug>]  # non-interactive preset
```

**Argument parsing:** same as `/work-issue` and `/create-issue` (GitHub syntax, `--repo` flag, cwd fallback).

## Pre-Flight

Run in this order — on the first failure, ABORT with a clear hint message.

1. **Repo-path lookup** in `~/.claude/work-issue-paths.yaml`.
   - If the live file is missing: `cp` from `references/repo-registry.yaml.example` (work-issue) as a bootstrap, then ask for `repo_path`.
   - If the legacy path `~/.claude/skills/work-issue/repo-paths.yaml` exists: print a migration hint (move it once), but keep working against the live path.
2. **AGENTS.md existence check** at the repo root (`<repo_path>/AGENTS.md`):
   - Present AND no `--refine`: ABORT.
     > AGENTS.md already exists in `<repo_path>`. Call `/init-agents --refine --repo <slug>` to extend it, or delete it manually first.
   - Present WITH `--refine`: parse the frontmatter, identify empty/missing fields.
   - Missing AND `--refine`: print the hint "AGENTS.md missing — running as a regular init", then proceed like `--interactive`/`--auto`.
3. **codebase-memory pre-flight** (same as `/work-issue`):
   - `list_projects` — check whether `<repo>` is indexed.
   - If not: `index_repository` with mode `moderate`.
   - If indexed: `index_status` — freshness check (>7 days AND a newer commit → re-index).
   - Health check: `nodes < 200` OR `source_files < 3` → warn "default heuristic may have excluded dirs (bin/, docs/, scripts/) — re-index with explicit paths recommended before running `/init-agents --auto`".

## Dialog workflow (--interactive, default)

The user is walked through all 11 mandatory frontmatter fields plus the optional `docs_command`, `commit_identity` and `test_globs` fields (14 total). **The total counts standards fields only:** the optional `models:` and `effort:` blocks in the same namespace select a per-stage model and a per-stage reasoning-effort level, and the optional `wallclock_cap_min` / `ci_poll_cap_min` fields set the loop's two time budgets (canonical in `skills/work-issue/SKILL.md`, "Hard caps"). None of the four says how this repo builds, tests or ships, so none is a standards field and none is in the 14 — the dialog does not ask for them, the template carries them commented out, and `/work-issue` falls back to its documented defaults. **`docs_command` is asked here even though it is optional** — see "Derived documentation" below for why the asking and the enforcing are two different gates. For each field, show a concrete default suggestion from codebase-memory + heuristic — the user accepts or overrides.

### 11 mandatory frontmatter fields

| Field | Default source / heuristic |
|-------|----------------------------|
| `branch_pattern` | `feature/<scope>-<issue>` (standard; include the issue number for branch↔issue↔PR traceability); derive from the last 20 branch names if a pattern is recognizable (`git branch -r`) |
| `default_branch` | `gh api repos/<slug> --jq .default_branch` |
| `pr_base` | = `default_branch`; if a `dev` branch exists (`gh api repos/<slug>/branches/dev`): suggest `dev` (do not set autonomously) |
| `commit_format` | `conventional` (count the last 30 commits: % matching `type(scope): description` — if >70% → `conventional`, otherwise `custom`) |
| `syntax_check` | derive from the dominant language via `get_architecture`: TypeScript → `tsc --noEmit`, JavaScript → `node --check <file>`, Python → `python -m py_compile <file>`, otherwise empty |
| `smoke_test` | from `docker-compose.yml` (if present) → `docker compose build && docker compose up -d --force-recreate`. Otherwise from `package.json scripts.test` or `pyproject.toml scripts.test`. Otherwise empty. **May be a plain string OR a scope mapping** — see "Optional field: scope-aware `smoke_test`" below. For a container-recreating command, propose the scope-mapping form with `parallel_safe: false`, since `--force-recreate` is unsafe to run while another loop is active. |
| `deploy_command` | empty (user decides) |
| `linter` | from the repo: detect `eslint`/`ruff`/`black` configs |

| `hard_gates` | list, defaults: "No direct edits on default_branch", "No new secrets in repo", "All MCP tools need a test example in their doc block", "no_unconfigured_coauthors" |
| `default_oos` | list, empty by default — the user adds repo-specific entries |
| `ac_templates` | list, defaults: "Code passes <syntax_check>", "Documentation in README/CLAUDE.md updated", "No new secrets in repo (secret check passed)" |

### Optional field: `docs_command` (derived documentation, opt-in)

`docs_command` is optional. **`/init-agents` still asks for it on every run** — that is deliberate, and the distinction is the point:

| Gate | Behaviour | Why |
|---|---|---|
| `/init-agents` dialog | **always asks** | Someone is already thinking about this repo. The question costs nothing and gets a considered answer |
| `/work-issue` pre-flight | **never blocks** on an absent field | A red pre-flight in an existing repo does not produce careful documentation — it produces a hastily written command that fails on its first run and is then deleted rather than fixed |
| `/work-issue` Tester step | **reports** absent vs. declared-empty | Not blocking must not mean silent. An absent field is a gap; a declared `""` is a decision. The run says which |

**Why not mandatory** — the cost is known, not hypothetical. When `docs_command` was first introduced as a mandatory field, it broke the pre-flight of **every** repo that already had an `AGENTS.md` within the hour; all of them had to be patched before any loop could run again. A field whose only effect is to regenerate documentation does not justify that. Contrast a field that **is** enforced strictly on an invalid value — the loop-type validation STOPs on an unknown `loop-type:` — because a wrong value there changes whether and how code ships.

Suggested default in the dialog: a JS/TS repo → a dependency-graph generator; a detected database → additionally a schema generator; otherwise empty. **Never propose a command that has not been verified to run** — an unverified `docs_command` fails on the first loop and gets deleted rather than repaired, which is the same failure this optionality is meant to avoid.

### Derived documentation — what it is for

**What it is for.** Described documentation — README, ADRs, architecture prose — carries intent and reasoning; it stays true for years but can go wrong silently the moment the code moves. Derived documentation is generated from what is actually there; it can only go wrong if the generator did not run. Both are needed, and they are different artefacts. `docs_command` covers the derived half.

**Where it runs.** `/work-issue` executes it inside the loop, before the Critic — not after the merge. That way the regenerated output sits in the same changeset as its cause: a pull request that adds a table shows the table, instead of leaving it to be reconstructed from a migration later.

**How strict.** Split by cost:

| Part | Mode |
|---|---|
| Generating the artefacts | **convenient** — regenerate and commit into the PR |
| Rule checks over them (forbidden dependencies, missing comments) | **strict** — fail the run |

Generating is mechanical, and a red run for it is pure detour — especially when the author is an agent, where it costs a full round trip. A rule check is not mechanical: a tool can draw a table but cannot know what it is for. **Automate what is mechanical, block on what a human must decide.**

**Three constraints, each of which has already gone wrong somewhere:**

1. **The generated output must carry no timestamp.** Otherwise the file changes on every run, the bot commits every time, and "the file changed" loses its meaning. Git records when.
2. **The generator must fail loudly when it cannot do its job** — missing toolchain, unresolvable dependency, an entire directory not covered. Skipping silently produces a valid-looking, incomplete file: the failure mode that looks like success.
3. **A rule must stay satisfiable.** If the correct fix leaves the rule red, the rule gets weakened rather than obeyed — and the weakening takes the protection with it.

### Optional field: `commit_identity` (author identity, opt-in)

`commit_identity` is an **optional** frontmatter field in the `work-issue:` namespace — one of three optional standards fields, alongside `docs_command` and `test_globs`. It fixes the author identity used for every commit the loop makes, so attribution no longer depends on ambient `git config` or assistant memory. Shape:

```yaml
commit_identity:
  name: "Your Name"
  email: "<id>+<user>@users.noreply.github.com"   # shape only — the identity rule is canonical in skills/github/SKILL.md §2
```

`/init-agents` **prompts** for it and offers a default derived from the repo owner (`gh api user --jq '.id, .login'` → `<id>+<login>@users.noreply.github.com`). The user can accept, edit, or SKIP. `SKIP` = block omitted; the loop then falls back to the ambient `git config` (so leaving it out is safe and changes nothing).

**What the loop does with the field, and the `no_unconfigured_coauthors` hard-gate it pairs with, are not restated here.** Both are git/gh interaction conventions, canonical in **`skills/github/SKILL.md`** (§2 and §3) and transcluded into the committing stages' briefs from there. This section documents only the field's *shape and opt-in semantics* — what `/init-agents` asks for and writes. `/init-agents` adds `no_unconfigured_coauthors` to the `hard_gates` default list; the rule behind the gate name lives in the `github` skill.

### Optional field: `test_globs` (execution-evidence revert-check paths, opt-in)

`test_globs` is an **optional** frontmatter field in the `work-issue:` namespace — the third of the three optional standards fields, alongside `docs_command` and `commit_identity`. It names the glob patterns that identify test paths in a diff, read only by the `/work-issue` Tester's execution-evidence **revert check**. Shape:

```yaml
test_globs:
  - "tests/**"
  - "**/*_test.go"
  - "**/*.test.ts"
```

`/init-agents` **offers** it — suggest globs from the detected test-dir / test-framework signals already gathered for the "Test conventions" body section below (`test/`, `tests/`, `__tests__/`, the dominant test framework's own file-naming convention). The user can accept, edit, or SKIP. `SKIP` = field omitted; the revert check then degrades to its documented absent-field state (a recorded value, not a silent skip — exact wording canonical in `skills/work-issue/SKILL.md`, "Execution evidence" §3).

**What the loop does with the field is not restated here.** The full execution-evidence procedure — applicability, the base run, the revert check this field feeds, the fail conditions and the evidence-block schema the Closer's merge gate reads — is canonical in **`skills/work-issue/SKILL.md`**, "Execution evidence". This section documents only the field's *shape and opt-in semantics*: what `/init-agents` asks for and writes, and that leaving it out is safe (the revert check degrades to a recorded, non-blocking `unavailable` state rather than STOPping the pre-flight).

### Optional shape: scope-aware `smoke_test` (opt-in, backwards-compatible)

`smoke_test` accepts **either** a plain string (the current form, unchanged) **or** a scope mapping. The plain string is the zero-change default and still behaves exactly as before. Offer the scope-mapping form when the repo has more than one testable area (e.g. a backend + a frontend), or when the smoke command is container-recreating (and therefore unsafe to run concurrently):

```yaml
smoke_test:
  backend: "<command>"        # run when the diff touches the backend scope
  frontend: "<command>"       # run when the diff touches the frontend scope
  default: ""                 # run when the diff matches no named scope (empty = skip)
  parallel_safe: true         # optional, default true; false = skipped by the Tester when another loop is active on the repo
  scopes:                     # only needed when AGENTS.md has no `components:` block
    backend:  ["api/**", "server/**", "**/*.py"]
    frontend: ["web/**", "app/**", "**/*.tsx"]
```

- **Scope resolution:** the `/work-issue` Tester resolves the scope from the diff paths — against `components.code_globs` if a `components:` block is set, otherwise against the mapping's own `scopes:` globs — and runs only the matching command. A diff that matches no scope is "not applicable to this diff scope" and the smoke step is skipped with a named reason.
- **`parallel_safe: false`:** declares a smoke test unsafe to run while another loop holds an active claim on the repo (e.g. `docker compose up -d --force-recreate`). The Tester then skips it with a reason when a concurrent claim exists. Default `true` = no change. This is a declaration only; the loop never auto-detects parallel-safety of an arbitrary command.

Full runtime semantics: see `skills/work-issue/SKILL.md` under "Scope-aware smoke_test" and the Tester stage.

### Optional block: `plan-issues:` (area + goal vocabulary, opt-in)

A repo may declare two vocabularies in the `plan-issues:` block — the subject **areas** its issues fall into, and the **goals** its issues serve. `/plan-issues` and `/create-issue` offer the area values when labelling `area:<name>`; `/create-issue` offers the goal values as a single-select when labelling `goal:<value>`:

```yaml
plan-issues:
  areas: ["<area>", "<area>", "..."]    # the repo's own subjects — there is no default list
  goals: ["<goal>", "<goal>", "..."]    # optional second vocabulary — the goal axis
  goal_default: "<goal>"                # optional; offered first in the single-select
  goal_prefix: "goal:"                  # optional; default goal:
  waiting_prefix: "waiting-on:"         # optional; default waiting-on:
```

**The contract — what `area:`/`bundle:` and `goal:`/`waiting-on:` mean, their grammar, lifetime, the configurable prefixes, the work-list query, the check-question, and label retirement — is canonical in `skills/plan-issues/SKILL.md`, sections "Label contract — `area:` and `bundle:` (canonical)" and "Label contract — `goal:` and `waiting-on:` (canonical)".** It is not restated here. The commented block in `references/AGENTS.md.template` is the one permitted copy artifact of its shape (both vocabularies), named as such at that canonical source.

**Dialog behaviour (areas):**

- **Offer, never auto-write** — same posture as the `components:` probe and the `models:` block. The user: APPROVE (name the areas) / SKIP.
- **Suggestion source:** existing `area:<name>` labels in the repo (`gh label list --repo <slug> --limit 1000 --json name --jq '.[].name'` → names matching `^area:`), then the top-level clusters from `get_architecture`. Offer them as a starting list; the user edits it.
- **SKIP is a first-class answer.** The block is omitted, `area:` values stay unvalidated, and `/plan-issues` says so once per run. Nothing breaks.
- **Never derive the list silently in `--auto`.** `--auto` ships without the block.

**Dialog behaviour (goals):**

- **Offer, never auto-write** — same posture as the areas probe. The user: APPROVE (name the goals, optionally a `goal_default`) / SKIP.
- **Suggestion source:** existing `goal:<value>` labels in the repo (the `^goal:` names from the same `gh label list`). There is no cluster-derived default — a goal is a human's statement of intent, not something to read off an architecture diagram.
- **Create the goal labels only when the block is set.** After the user names the goals, create each `goal:<value>` repository label (resolved against `goal_prefix`, default `goal:`), exactly like the loop-type and area labels — see "Goal-label creation" in the output steps. SKIP → no `goal:` labels are created and `/create-issue` asks no goal question.
- **Never derive goals silently in `--auto`.** `--auto` ships without the block; no goal labels are created.

`plan-issues:` is **not** one of the mandatory frontmatter fields and must never enter the `/work-issue` completeness pre-flight. A block whose only effect is a warning (areas) or an opt-in question (goals) has no business turning into a STOP for every repo that predates it.

### Optional block: `strategy:` (strategic framework, opt-in)

A repo may declare the top-level `strategy:` block — the `feature:` issue-label axis, pointers to a real PRD/SDD, and the four gates that switch existing mechanisms from optional to strategically-required. `/init-agents` **offers** the block; it never writes it autonomously.

**The block's shape and its opt-in semantics are canonical in this plugin's `AGENTS.md`, section "Strategic Software Development (optional `strategy:` block)"**, and are not restated here. Neither is anything the block points at: the `feature:` label contract is canonical in `skills/plan-issues/SKILL.md`, what each gate injects into an issue's ACs in `skills/create-issue/SKILL.md`, and the gate pre-flight report in `skills/work-issue/SKILL.md`. The commented block in `references/AGENTS.md.template` is the one permitted copy artifact of the shape.

**Dialog behaviour:**

- **Offer, never auto-write** — the same posture as the `components:` probe, the `models:` block and `plan-issues:`. The user: APPROVE / SKIP.
- **SKIP leaves `/init-agents` behaving exactly as it did before this block existed** — no `strategy:` block, no design-doc question, no strategic Q&A, no extra body section, no label. Zero behaviour change, in this skill and everywhere downstream.
- **On APPROVE, ask three things in this order:** the design docs (below), the `feature_axis` values (offer the defaults from the canonical shape), and each of the four `gates:` booleans. **Partial blocks are legal**, so any one of the three sub-blocks may be skipped on its own without affecting the others.
- **Never in `--auto`.** An autonomous run ships without `strategy:` and asks no strategic Q&A — the strategic posture is a human's decision, not something to read off a cluster diagram.

#### Design docs — consume if present, ask if absent

`design_docs.prd` / `.sdd` are **pointers, not containers**; their three-state convention is canonical in `AGENTS.md` (the same convention `docs_command` uses). What the dialog does in each state:

| State of the repo | What the dialog does | What is written |
|---|---|---|
| A real PRD and/or SDD exists (typically a client project) | record the confirmed path and **point** at it — no questions, no copying: the document is the source | `prd: "<path>"` / `sdd: "<path>"` |
| No such document exists (prototype, takeover, small internal tool) | run the strategic Q&A below and write the answers into the AGENTS.md **body** | `prd: ""` / `sdd: ""` — the decision "this repo has no separate PRD" is *recorded*, not left blank |
| The user SKIPs the `design_docs` sub-block or the whole `strategy:` block | nothing | no `design_docs` sub-block at all — **absent means nobody has decided yet**, and a later `--refine` asks again |

The middle and bottom rows are the distinction worth getting right: `""` is an answer, an absent key is an open question. `--refine` re-asks the absent key and leaves a declared `""` alone.

**Detection is a suggestion, never an assertion.** Probe the obvious locations (`docs/prd*`, `docs/PRD*`, `docs/sdd*`, `docs/design*`, plus a `docs/` or `spec/` cluster from `get_architecture`) and offer the hits for confirmation. A path is written only after the user confirms the document genuinely is the PRD/SDD. A wrong pointer is worse than an empty one: every stage of every loop would then load the wrong document as strategic context, and nothing would report it.

**No second document is ever scaffolded.** When no PRD/SDD exists, `/init-agents` does not create one, does not copy a template into the repo, and does not offer to. A reconstructed design document nobody asked for is a second version of the truth, and it drifts silently because nobody reads it. The strategic essence goes into the AGENTS.md body, which every stage of every loop already loads as context. Rationale: `docs/adr/0010-init-agents-design-docs.md`.

#### The strategic Q&A (only on the no-design-docs path)

Four questions, asked once, in this order. They mirror the essential PRD/SDD sections without reproducing a template, and each answer has a home in the body — section names as they appear in `references/AGENTS.md.template`:

| Question | Body section that receives the answer |
|---|---|
| **Purpose and non-goals** — what is this for, and what is explicitly *not* being built? | `## Purpose and Non-Goals` |
| **Leading decision** — the one architectural choice everything else follows from | `### Leading Decision`, under the architecture section |
| **Core components and their placement** | the architecture section itself |
| **The test bar** — what must be green for a change to count as done | the test-conventions section |

- **Short answers are the point.** Two or three sentences each. This captures the essence; anything longer is a document, and a document should be written as one and pointed at from `design_docs`.
- **An empty answer is legal.** The section then ships with its placeholder, exactly like the known-gotchas section, and gets filled after the first build.
- **The Q&A runs only when no design docs were declared.** With declared paths the documents are the source, and asking the same questions again would produce precisely the second version of the truth this path exists to avoid.
- **Still exactly one file.** Every answer lands in `<repo_path>/AGENTS.md`; no other file is written on this path.

#### No labels are created from `strategy:`

Declaring the block implies **no** `gh label create` at all — this is a deliberate no-op, not an omission:

- **`feature:` labels are never pre-seeded.** `feature_axis` has no vocabulary field on purpose: the legal values are deliberately not enumerated in AGENTS.md, the repo's existing `feature:*` labels are the working vocabulary, and `/create-issue` creates each `feature:<name>` on demand when a feature is first named. Contract: `skills/plan-issues/SKILL.md`, "Label contract — `feature:` (canonical)". Pre-seeding a list here would invent a second vocabulary source for an axis that deliberately has none.
- **`gates:` implies no labels either** — the four booleans switch mechanisms that already exist; they carry no taxonomy.

The only labels `/init-agents` creates from a declared vocabulary stay the `goal:*` ones, which come from `plan-issues.goals` (see "Goal-label creation") because that vocabulary *is* declared. `strategy:` has none, so nothing is created.

Like `plan-issues:`, `strategy:` is **not** a mandatory frontmatter field and must never enter the `/work-issue` completeness pre-flight.

### Optional field: `components:` (component-registry, opt-in)

Between the 11 required frontmatter fields and the body sections, run a **component-pattern probe**. Purpose: propose an opt-in `components:` block only when the repo shows real reusable-component patterns; skip cleanly otherwise.

**Detection signals (via codebase-memory + file lookup):**

- **Frontend framework presence** — any `.tsx`, `.jsx`, `.vue`, or `.svelte` file in the repo (`get_architecture` + `search_code` for `*.tsx`/`*.jsx`/`*.vue`/`*.svelte`).
- **Backend domain layer** — any path under `src/domain/**`, `src/entities/**`, or `src/aggregates/**` (`get_architecture` cluster names + a directory-existence probe).

**Dialog behavior:**

- **No signal fires** — skip the `components:` block silently. AGENTS.md ships without it. Zero behavior change downstream.
- **Frontend signal fires** — propose a `components:` block with `scope: frontend`, `registry_path: "docs/components.md"`, `code_globs` seeded with the detected framework glob (e.g. `["src/components/**/*.tsx"]`), and `usage_policy: prefer_existing`.
- **Backend signal fires** — propose with `scope: backend`, `code_globs` seeded with the detected domain path (e.g. `["src/domain/**/*.ts"]`).
- **Both fire** — propose with `scope: both` and both globs.

In every proposed case: also offer to copy `references/components-registry-template.md` to the resolved `registry_path` as a starting skeleton (worked frontend + backend example). User: APPROVE / EDIT / SKIP. `SKIP` = block omitted, no registry file written.

Rationale + full schema: see `AGENTS.md` in this plugin repo under "Component Registry".

### Body sections

Four standard sections on every run. For each, show 1-3 suggestions from codebase-memory or cluster analysis; the user accepts or writes their own.

| Section | Default source |
|---------|----------------|
| **Architecture (short)** | `get_architecture` → top 3 clusters + main components as a suggestion |
| **Code style / conventions** | `search_code` for dominant naming patterns + lint config findings |
| **Test conventions** | test-dir detection (`test/`, `tests/`, `__tests__/`) + dominant test framework from `package.json`/`pyproject.toml` |
| **Known gotchas** | empty initially — the user fills it in later (skill recommendation: "empty section is fine, add to it after the first build") |

Two further sections exist in the template and are **filled only on the strategic Q&A path** (see "Optional block: `strategy:`"); off that path they keep their placeholder, like any unanswered section:

| Section | Filled by |
|---------|-----------|
| **Purpose and Non-Goals** | the purpose/non-goals question |
| **Leading Decision** (under the architecture section) | the leading-decision question |

The core-components and test-bar answers go into the architecture and test-conventions sections above — they need no section of their own.

## Auto workflow (--auto)

Run through the full default heuristic — no user dialog. The output is a preview; the user gets a YES/NO prompt at the end.

Defaults:
- **branch_pattern**: `feature/<short>` (safe default, no autonomous pattern detection)
- **default_branch**: via `gh api repos/<slug> --jq .default_branch`
- **pr_base**: = `default_branch` (never autonomously switch to `dev`, even if `dev` exists — only suggested in the interactive dialog)
- **commit_format**: `conventional` as default (safe default)
- **syntax_check**: from the dominant language via cluster analysis
- **smoke_test**: from `docker-compose.yml` / `package.json` / `pyproject.toml`
- **deploy_command**: empty
- **linter**: from detected config files
- **docs_command**: omitted entirely in `--auto` unless the repo cluster clearly supports a generator and the command has been verified to run. Optional means an autonomous run may legitimately leave it out
- **commit_identity**: default derived from the repo owner (`gh api user --jq '.id, .login'` → `<id>+<login>@users.noreply.github.com`); the user confirms in the interactive dialog. Omitted only if `--auto` cannot resolve an owner.
- **test_globs**: omitted entirely in `--auto` — a test-path glob a human has not confirmed can silently mis-scope the revert check's non-test-path checkout; leaving it out is the safe default and costs nothing (the revert check then records `unavailable`, never a STOP). Optional means an autonomous run may legitimately leave it out, same posture as `docs_command`.
- **hard_gates**: standard gates including `no_unconfigured_coauthors` (see above)
- **plan-issues**: omitted — the area and goal vocabularies are a human's lists (of subjects, of intents), not something to derive from a cluster diagram. Absent = `area:` values accepted unvalidated and no goal question / no `goal:*` labels, which is a working state
- **strategy**: omitted, and **no strategic Q&A is asked** — opting into the strategic posture, pointing at a PRD/SDD and switching gates on are decisions, not defaults. Absent block = zero behaviour change; `--refine` offers it later
- **default_oos**: empty
- **ac_templates**: 3 standard templates (see above)
- **body sections**: populated from `get_architecture` + `search_code`; known gotchas empty

## Refine workflow (--refine)

1. Read the existing `<repo_path>/AGENTS.md`.
2. Parse the YAML frontmatter using the same `python3` → `node` → structural-scan fallback chain `/work-issue`'s pre-flight uses — canonical, including each rung's exact command and tested coverage boundary: `skills/work-issue/references/tool-requirements.md`, "The YAML-parseability fallback chain".
3. For each field, check: empty/missing? → add to the refine list.
4. Dialog ONLY for fields in the refine list — others stay untouched.
5. Body sections similarly: empty/missing → dialog, otherwise untouched.
6. **`models:` / `effort:` block offer** — if either block is absent in the existing AGENTS.md, **offer** it as one of the dialog steps (alongside any other missing fields). Never write either autonomously. The user: APPROVE (pick preset in the next step) / SKIP. This is the same posture as the `components:` probe: detect, propose, never auto-write. A preset sets both axes; a user who wants only one may take the preset and delete the other block.
7. **`plan-issues:` block offer** — same posture: absent block → offer the area vocabulary and the goal vocabulary (see "Optional block: `plan-issues:`"); SKIP leaves either out, never write autonomously. If goals are named on this path, create the `goal:*` labels (see "Goal-label creation").
8. **`strategy:` block offer** — same posture again: absent block → offer it (see "Optional block: `strategy:`"), running the design-doc question and, only if no PRD/SDD is declared, the strategic Q&A. A partially declared block is treated per sub-block: an absent `design_docs` key is re-asked, a declared `""` is a recorded decision and is left alone. Answers land in the existing body sections, adding `## Purpose and Non-Goals` / `### Leading Decision` if the file does not have them yet. SKIP leaves the block out; no labels are created either way.
9. Show the diff, user APPROVES/CANCELS.

## Models workflow (--models)

Retrofit path for repos that already have a **complete** AGENTS.md. Adds the `models:` and `effort:` blocks if absent, or updates them if present. The flag keeps its name and now covers both axes — a preset that set only one of them would set them incoherently.

Design rationale: `docs/adr/0017-per-stage-effort-axis.md` (the effort axis and why it is declarative today) and `docs/adr/0018-implementer-model-default.md` (the Implementer tier the presets now write).

**Pre-flight:**
- AGENTS.md missing → ABORT:
  > AGENTS.md missing — please run `/init-agents --repo <slug>` first.
- AGENTS.md present and complete → proceed (this is the retrofit path; this is not a STOP).
- `references/model-presets.md` unreadable → **ABORT**:
  > canonical preset source missing — run `claude restart` to refresh the plugin cache.

  Never reconstruct a preset mapping from memory or from the template. The plugin cache path is version-scoped, so a stale cache after a version bump is the realistic failure case.

**Interactive (no `--preset`):**
1. Read the existing `models:` block (or start empty).
2. Present the recommended mapping table from `references/model-presets.md` (canonical source) — model **and** effort column — and ask the user to pick a preset (`balanced` / `economy` / `quality` / `inherit`) or enter custom values per stage on either axis.
3. Show the proposed `models:` and `effort:` blocks as a diff. User: APPROVE / CANCEL.
4. Say once, in the dialog, what the effort block does today: the current subagent dispatch carries no effort parameter, so the block is recorded and not applied (canonical statement: `skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch"). Do not offer it as a live cost lever.

**Non-interactive (`--preset <name>`):**

Preset names: `balanced` / `economy` / `quality` / `inherit`. The values on both axes **and** the trade each preset makes are in `references/model-presets.md` (canonical source) — read it before resolving a preset; do not resolve one from memory, and never fall back to a remembered alias or effort level. There is no preset value anywhere in these skills.

`inherit` writes neither a `models:` nor an `effort:` key at all — parsing the frontmatter afterwards yields neither, restoring today's session-inherit, default-effort behavior.

**Approval gate:** `--preset` is non-interactive in the sense that it **skips the preset-picking dialog**, not that it writes unattended. Like `--auto`, it still renders the resulting diff and takes a final **YES/NO prompt** before writing. There is no unattended-write mode for `models:` or `effort:`.

**Write path — how this path runs the output steps below:**

| Output step | On `--models` |
|-------------|---------------|
| 1. Preview | **Runs** — previews the `models:` + `effort:` diff against the existing AGENTS.md, not the full file. User: APPROVE / CANCEL |
| 2. Write AGENTS.md | **Runs** — inserts / updates / removes only the `models:` and `effort:` blocks; every other field stays byte-for-byte untouched |
| 3. Extend README.md | **Skipped** — this is a retrofit against a repo that already ran a full init, so the "For Contributors / AI Agents" section already exists |
| 4. Branch + commit + PR + merge | **Runs**, with this path's own branch name: `feature/agents-models` (or per `branch_pattern`) — **not** the init path's `feature/init-agents-md`. Commit message: `feat(agents): add models: and effort: blocks to AGENTS.md (via /init-agents --models)` |
| 5. Repo-registry update | **Runs** — idempotent: sets `agents_md_exists: true` (usually already true on this path) and creates the entry if the pre-flight had to bootstrap the registry |
| 6. Channel reply | **Runs** — "models: + effort: blocks set for `<slug>` (preset `<name>`, PR #N merged)." |

## Output steps (after dialog/auto/refine/models)

1. **Preview** — render the full AGENTS.md content (frontmatter + body). User: APPROVE / REVISE / CANCEL.
2. **Write AGENTS.md** to `<repo_path>/AGENTS.md`.
3. **Extend README.md** with a "For contributors / AI agents" section, if not already present:
   ```markdown
   ## For Contributors / AI Agents
   This repo uses `AGENTS.md` as the standards spec for AI-assisted
   workflows (`/work-issue`, `/create-issue`). Change conventions
   there, not inline in code review.
   ```
4. **Branch + commit + PR + merge** (same as `/work-issue` Implementer/Closer):
   - Branch: `feature/init-agents-md` (or per `branch_pattern`)
   - Commit message: `chore(agents): add AGENTS.md (init via /init-agents)`. The commit, the push and the PR body follow the git/gh conventions canonical in **`skills/github/SKILL.md`** — read that file before committing (this skill is read directly, so it points rather than restates). If `commit_identity` was set in the dialog, it is the identity those conventions apply.
   - PR body: short, refer to the AGENTS.md format
   - Squash-merge (delete-branch)
5. **Repo-registry update (mandatory step)** — live file `~/.claude/work-issue-paths.yaml`:
   ```bash
   yq -i '.["<owner>/<repo>"].agents_md_exists = true' ~/.claude/work-issue-paths.yaml
   # Fallback without yq:
   # sed edit or Python update on the same live file
   ```
   If the entry does not yet exist: create a minimal one first (`repo_path` from the pre-flight is known).
6. **Channel reply** (if invoked from a `<channel>` inbound): "AGENTS.md created for `<slug>` (PR #N merged). The repo is ready for `/work-issue`."

### Goal-label creation (only when `plan-issues.goals` is set)

When the dialog captured a `plan-issues.goals` list, create the `goal:<value>` repository labels so `/create-issue` can attach them — the same pattern as the loop-type and area label creation:

```bash
gh label create "goal:<value>" --repo <slug> --color C5DEF5 --description "Goal axis" --force
```

Resolve the prefix against `goal_prefix` (default `goal:`). No `goals` list → this step does not run and no `goal:` label exists (zero behavior change). The `waiting-on:<value>` labels are **not** created here: a waiting-on label is written on demand by whoever discovers a block (with the note recording what is waited on), not pre-seeded — contract in `skills/plan-issues/SKILL.md`.

## Known limitation (plugin-cache freshness)

When `/init-agents` first becomes available after a plugin update, the plugin cache has to be fresh BEFORE the first call (`claude restart`). Without it the running Claude keeps serving the cached skill versions rather than the ones the update installed, so neither `/init-agents` nor `/work-issue` (pure-reader) is visible in its current form.

The same applies to any other repo: every time a repo gets its AGENTS.md for the first time, a `claude restart` should happen before the next `/work-issue` run in that repo (so the pure-reader sees the fresh file). In practice, a session reload is usually enough.

## AGENTS.md format reference

Template file: `references/AGENTS.md.template` (in this skill).

Schema (abbreviated):

```yaml
---
work-issue:
  branch_pattern: "feature/<scope>-<short>"
  default_branch: main | dev
  pr_base: main | dev
  commit_format: "conventional" | "custom"
  syntax_check: "<command>"
  smoke_test: "<command>"             # plain string OR scope mapping (backend/frontend/default + optional parallel_safe, scopes)
  deploy_command: "<command>"
  linter: "<command>"
  docs_command: "<command>"           # optional — omit entirely, or "" for "not applicable"
  commit_identity:                    # optional
    name: "<name>"
    email: "<id>+<user>@users.noreply.github.com"
  test_globs:                         # optional — absent = the revert check records "unavailable"
    - "<glob>"
  models:                             # optional — absent = inherit the session model for every stage
    validator:   <alias>              # aliases only: opus | sonnet | haiku | fable
    implementer: <alias>
    tester:      <alias>
    visual:      <alias>              # unused when visual: block is absent
    critic:      <alias>
    closer:      <alias>
  effort:                             # optional — absent = the API/session default effort for every stage
    validator:   <level>              # levels only: low | medium | high | xhigh | max
    implementer: <level>
    tester:      <level>
    visual:      <level>              # unused when visual: block is absent
    critic:      <level>
    closer:      <level>
  hard_gates: ["...", "no_unconfigured_coauthors"]
  default_oos: ["..."]
  ac_templates: ["..."]

plan-issues:                          # optional — absent = area: values unvalidated, no goal question
  areas: ["<area>", "<area>"]         # the repo's subject vocabulary; an unknown value warns, never STOPs
  goals: ["<goal>", "<goal>"]         # optional goal axis; single-select at /create-issue, creates goal:* labels
  goal_default: "<goal>"              # optional; offered first
  goal_prefix: "goal:"                # optional; default goal:
  waiting_prefix: "waiting-on:"       # optional; default waiting-on:

strategy:                             # optional — absent = zero behavior change; offered, never auto-written
  feature_axis:                       # the feature: issue-label axis (no vocabulary field — no labels pre-seeded)
    prefix: "feature:"
    require_on: [enhancement]
    flag_over: 10
  design_docs:                        # path = the document exists; "" = decided, none; key absent = not decided yet
    prd: ""
    sdd: ""
  gates:                              # switch existing mechanisms to strategically-required
    architecture_adr: true
    component_reuse:  true
    test_evidence:    true
    documentation:    true
---

# Agent Instructions for <repo-name>

## Purpose and Non-Goals       # strategic Q&A path only
## Architecture (short)
### Leading Decision           # strategic Q&A path only
## Code Style
## Test Conventions
## Known Gotchas
```

Full example: see `references/AGENTS.md.template`.

## Scope boundaries

| Skill | When |
|-------|------|
| `/init-agents` | Repo has no AGENTS.md yet → mandatory bootstrap BEFORE the first `/work-issue` run |
| `/create-issue` | Idea → specified GitHub issue. Calls `/init-agents` as a pre-step if AGENTS.md is missing |
| `/work-issue` | Pure-reader: needs AGENTS.md at the repo root. Without AGENTS.md → STOP verdict with a pointer to `/init-agents` |

`/init-agents` and `/create-issue` are complementary:
- `/init-agents` captures **standards** (once per repo)
- `/create-issue` captures **issues** (continuous, per feature/bug)

`/init-agents` and `/work-issue` are sequential:
- `/init-agents` is the **mandatory bootstrap** before the first `/work-issue` run in a repo.

## What this skill does NOT do

- **No schema versioning** (e.g., a `schema_version: 1` field). Planned for a future release if a migration is needed.
- **No auto-detection of a dev-branch flow** in `--auto` mode — if a `dev` branch exists, it is **suggested** in the interactive dialog but never set autonomously as `pr_base`.
- **No AGENTS.md for non-code repos** (e.g., docs-only repos). The skill assumes a code repo.
- **No cross-repo standards inheritance** — every repo has its own AGENTS.md.
- **No autonomous `models:` or `effort:` write in `--auto` or `--refine`** — `--refine` offers the blocks and the user decides; `--auto` ships without them (absent = zero behavior change on both axes). Use `--models` to add or update them explicitly.
- **No autonomous `plan-issues:` write, and no derived area or goal vocabulary** — the block (areas and goals alike) is offered in the interactive and `--refine` dialogs and omitted otherwise; `goal:*` labels are created only when the user names goals.
- **No autonomous `strategy:` write, and no strategic Q&A in `--auto`** — the block is offered in the interactive and `--refine` dialogs and omitted otherwise. Declining leaves the skill behaving exactly as it did before the block existed.
- **No PRD or SDD is ever scaffolded, and no `feature:` label is ever pre-seeded** — `design_docs` points at documents that already exist, and the feature axis has no declared vocabulary to seed from (contract: `skills/plan-issues/SKILL.md`).

## See also

- `references/AGENTS.md.template` — full example + schema
- `skills/work-issue/SKILL.md` — pure-reader loop that reads AGENTS.md
- `skills/create-issue/SKILL.md` — issue genesis, calls `/init-agents` as a pre-step
- `skills/plan-issues/SKILL.md` — canonical `area:` / `bundle:` / `goal:` / `feature:` label contracts, consumer of `plan-issues.areas`
- `skills/work-issue/references/repo-registry.yaml.example` — repo-registry template
- `docs/adr/0008-strategy-block.md` — why the `strategy:` block exists; `docs/adr/0010-init-agents-design-docs.md` — why the offer consumes design docs instead of scaffolding them

## Optional `visual:` block (Visual Reviewer Gate)

`/init-agents` documents the optional `visual:` block in the AGENTS.md template (commented out by default). It is opt-in and applies only to repos with a frontend: absent block = zero behavior change.

When the target repo shows frontend signals (a framework: `.tsx`/`.jsx`/`.vue`/`.svelte`, or a `package.json` with a dev/preview server script), `/init-agents` may propose a `visual:` block with sensible defaults:

```yaml
visual:
  serve_command: "npm run preview"     # how to serve the built frontend
  base_url: "http://localhost:4173"    # where the served app answers
  viewports:                           # default: mobile-first
    - { w: 390,  h: 844,  label: mobile }
    - { w: 1280, h: 800,  label: desktop }
  routes: ["/"]                        # default routes; issues can override/extend
  console_error_policy: "fail"         # fail | warn
  screenshot_dir: ".stagecrew/visual"
  scope: "frontend"
```

When set, `/work-issue` runs the Visual Reviewer stage (3.5) for frontend-scoped issues (see `AGENTS.md` "Visual Reviewer Gate" and `docs/adr/0002-visual-gate.md`). Requires the Playwright companion MCP; absent → the stage is skipped cleanly.
