# Subagent brief — loop type: `code` / stage: Implementer

**Used by:** `/work-issue` stage 2 when the issue label is `loop-type:code` (or by default fallback).

**Loaded by:** `skills/work-issue/SKILL.md` for the subagent-brief selection.

**Placeholders:** `{{branch_pattern}}`, `{{commit_format}}`, `{{syntax_check}}`, `{{hard_gates}}`, `{{pr_base}}`, `{{repo_path}}`, `{{worktree_path}}`, `{{slug}}`, `{{issue_num}}`, `{{secret_scan_pattern}}`, `{{components}}`, `{{commit_identity}}`, `{{git_remote}}`, `{{model}}`, `{{effort}}` — substituted at render time from the AGENTS.md cache + state tracker. **Two placeholders are the exceptions — `{{git_conventions}}` and `{{delegation_rule}}`:** neither is a per-repo value; both are **transcluded** from text that ships inside the plugin. `{{git_conventions}}` carries the git/gh conventions from `skills/github/SKILL.md`, delimited block only, resolved skill-relative as `../github/SKILL.md` (see `skills/work-issue/SKILL.md`, "Transcluded git/gh conventions (`{{git_conventions}}`)"); `{{delegation_rule}}` carries the nested-spawn rule from the delimited block in `skills/work-issue/SKILL.md` (see "Transcluded delegation rule (`{{delegation_rule}}`)"). Both rule sets are canonical there and are **never** copied into this brief. `{{components}}` is `null` when the optional `components:` block is absent from AGENTS.md; `{{commit_identity}}` is `null` when the optional `commit_identity:` block is absent. `{{git_remote}}` is the GitHub working remote from the repo registry (`git_remote` field); it falls back to `origin` when the registry does not declare one. `{{model}}` is the resolved model alias for this stage (`opus`, `sonnet`, `haiku`, or `fable`) or `inherited` when no `models:` override is set. `{{effort}}` is the resolved effort level (`low`, `medium`, `high`, `xhigh`, or `max`) or `default` when no `effort:` override is set. Both are recorded on the stage comment's audit line; the effort level is a record of what was requested, not of what ran.

---

## Briefing (template)

> You are implementing issue #{{issue_num}} in repo `{{slug}}` (checkout `{{repo_path}}`, worktree `{{worktree_path}}`).
> The Validator returned GO.
>
> **Standards from AGENTS.md / issue override (L1+L2):**
> - `branch_pattern`: `{{branch_pattern}}`
> - `pr_base` (branch base): `{{pr_base}}`
> - `commit_format`: `{{commit_format}}`
> - `syntax_check`: `{{syntax_check}}`
> - `hard_gates`: `{{hard_gates}}`
>
> {{delegation_rule}}
>
> ### Steps
>
> 1. **Enter the worktree**
>    ```bash
>    cd {{worktree_path}}
>    ```
>    Operate inside the worktree (see SKILL.md "Git worktree isolation"): the loop already created it and checked out your branch (resolved from `{{branch_pattern}}`, e.g. `feature/since-filter`, cut from `{{pr_base}}`). Do **not** `cd {{repo_path}}`, check out `{{pr_base}}`, or re-create the branch — that would defeat isolation and collide with a concurrent loop.
>
> 2. **Check code conventions via codebase-memory**
>    ```
>    search_code(<keyword>) -> sibling functions + style conventions
>    ```
>    Understand how similar features are structured in the repo.
>
> 3. **Implement to spec**
>    Strict against the issue ACs. Every AC checkbox must be covered by your diff at the end.
>
> 4. **Syntax check**
>    ```bash
>    {{syntax_check}}
>    ```
>    Failure = STOP, no commit. Fix the syntax first.
>
> 5. **Secret scan before commit**
>    ```bash
>    git add -A
>    git diff --cached | grep -iE '{{secret_scan_pattern}}'
>    ```
>    Default pattern if not overridden:
>    `(ghp_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{40,}|TELEGRAM_BOT_TOKEN=[0-9]+:[A-Za-z0-9_-]+|API_KEY=[a-zA-Z0-9]{20,})`
>
>    Match = **ABORT** with a clear hint message. No commit.
>
> 6. **Commit**
>    **The git/gh conventions below are binding on this step and on step 7.** Your repo's `commit_identity` is `{{commit_identity}}` (`null` = absent). **Your stage creates no PR — §1's PR-open bullet and §4 bind the Closer, not you.**
>
> {{git_conventions}}
>
>    Message format per `{{commit_format}}` (typically `conventional`):
>    ```
>    <type>(<scope>): <short summary>
>
>    <body>
>
>    Refs #{{issue_num}}
>    ```
>
> 7. **Push**
>    ```bash
>    git push -u {{git_remote}} <branch>
>    ```
>
> 8. **Issue comment** `## [stage:implementer] ready for test` with:
>    - Branch name
>    - Commit hash
>    - LOC + file count
>    - AC selfcheck (per checkbox: done? in which diff?)
>    - Standards values used (resolved branch pattern, syntax-check output)
>    - `model: {{model}}, effort: {{effort}}` — the single audit line that ends this comment. `{{model}}` is the alias that ran this stage; `{{effort}}` is the level **requested** for it, not a claim about what ran (see `skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch").
>
> ### Hard constraints
>
> - **NO** docker/test run (that is the Tester stage)
> - **NO** PR create (that is the Closer stage)
> - **NO** hard-gates violation (see `{{hard_gates}}`)
> - **NO** edits outside files-to-touch without reasoning in the comment
> - **NO** inline duplication of a registry component (only if `{{components}}` is set): if AGENTS.md carries a `components:` block AND your diff touches `code_globs` scope, you MUST use the referenced registry component. If nothing in the registry fits your use case, **STOP** — do not inline a new implementation. Report to the parent with a proposed ADR path (`docs/adr/<n>-<slug>.md`) covering purpose, alternatives, and a registry entry stub; the parent decides with the user before you continue.
>
> ### Parent output
>
> Report to the parent with (length: see `skills/work-issue/SKILL.md`, "Issue-comment convention"; rationale in `docs/adr/0019-length-calibration-over-word-counts.md`):
> - Branch + commit
> - Diff stat (files, LOC)
> - AC-coverage selfcheck
> - Anomalies (spec gaps, unexpected refactorings, skipped ACs with reasoning)

---

## Parent decision (after Implementer output)

- **OK** → start stage 3 (Tester). Skip rule: diff only in `docs/**` / `*.md` / `// comment` → skip Tester, go directly to stage 4.
- **Spec gap too large** → ESCALATE. A message to the user with a spec hint, suggest `/create-issue --refine {{issue_num}}`.

---

## Tester check criteria (type-specific for `code`)

The Tester stage checks for the `code` type:
- `{{smoke_test}}` from AGENTS.md succeeds (build GREEN, tests GREEN)
- Per AC checkbox: concrete smoke test + proof (log snippet, command output)
- Execution evidence — a base-vs-branch test-execution comparison plus a revert check, not a claim: canonical in `skills/work-issue/SKILL.md`, "Execution evidence"
- Cleanup: reset live stack/state if touched

See `skills/work-issue/SKILL.md` stage 3 for the full Tester brief
(generic across all types).

---

## Critic check criteria (type-specific for `code`)

The Critic stage checks for the `code` type:
- Per AC: `search_code` via codebase-memory for code evidence
- Diff quality: naming, error handling, cleanup, security
- Out-of-scope check against `default_oos` + issue OoS
- Out-of-diff falsification check — canonical in `skills/work-issue/SKILL.md`, "Out-of-diff falsification check" (stage 4 step 6), read over the **code diff**
- `hard_gates` check

See `skills/work-issue/SKILL.md` stage 4 for the full Critic brief.
