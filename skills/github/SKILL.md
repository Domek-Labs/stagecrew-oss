---
name: github
description: "Git and GitHub interaction conventions for loop commits, pushes, and PRs. Use gh / the GitHub API for writes when the local .git is read-only (constrained containers); set the commit author from AGENTS.md commit_identity; never a company/shared email; no Co-authored-by trailers unless configured (no_unconfigured_coauthors); PR body conventions (Closes #, standards block) and the squash-merge co-author caveat. Triggers: github, git push, gh cli, commit identity, commit author, coauthor, co-author, pull request, pr body, squash merge."
---

# github — git / gh interaction conventions

**Type:** reference / convention

Shared conventions for every stagecrew stage that touches git or GitHub (Implementer, Closer, `/init-agents`). Keeps commit attribution clean and drift-free.

## Canonical source (read this before editing anything below)

**This file is the canonical source for the git/gh interaction conventions** — the commit author identity from AGENTS.md `commit_identity`, the `no_unconfigured_coauthors` rule, `gh`-instead-of-`git` on a read-only `.git`, the PR-body conventions, the squash-merge co-author caveat, and the non-interactive-shell rules. Every consumer in this repo either **points** here or **receives the text by transclusion**; none of them restates a rule, except the one declared copy artifact named below. Change a convention here and nowhere else.

**Transclusion into the rendered subagent briefs.** The two Implementer briefs and the inline Closer briefing cannot follow a pointer — a subagent receives a rendered brief, not a filesystem. They therefore carry the placeholder **`{{git_conventions}}`**, which `skills/work-issue/SKILL.md` fills from this file at dispatch time, exactly as it already fills `{{commit_identity}}` and `{{git_remote}}`. The rules stay in one file and every rendered brief carries the current text by construction — there is no copy to keep in sync.

- **Path resolution is skill-relative:** the render step reads `../github/SKILL.md` from its own skill directory (`skills/work-issue/`). There is no `CLAUDE_PLUGIN_ROOT` and no plugin-cache lookup — the plugin's own directory layout is the only thing that has to hold. This is the repo's existing precedent (`skills/work-issue/SKILL.md` already reads `../init-agents/references/AGENTS.md.template`).
- **The injected extent is the delimited block below, and nothing else:** everything between the two `git_conventions` HTML-comment markers (BEGIN and END) that stand alone on their own lines further down, i.e. §1–§6 verbatim. Keep each marker on a line of its own and never reproduce a full marker comment elsewhere in this file — the render step locates them by whole-line match, and a marker buried in a sentence is a decoy. The YAML frontmatter, this section and the "See also" are **outside** the block on purpose — the frontmatter is loader metadata, and "See also" points back at the briefs, which would be a circular reference inside a rendered brief.
- **A new section belongs inside the markers only if a committing stage must obey it.** Anything a stage does not act on (metadata, cross-links, rationale) goes outside them. Moving a marker changes what every brief receives; say so in the PR.

Full mechanics, including the failure mode when the block cannot be read: `skills/work-issue/SKILL.md`, "Transcluded git/gh conventions (`{{git_conventions}}`)". Rationale: `docs/adr/0012-transcluded-git-conventions.md`.

**Declared copy artifact — one.** `skills/init-agents/references/AGENTS.md.template` restates these conventions in two comments: the `never a company/shared email` note beside its `commit_identity` entry (§2) and the `no_unconfigured_coauthors` note beside its `hard_gates` entry (§3, §5). That file is **not** rendered and never sees this one: a human reads it inside a foreign repo, where nothing resolves a path into this plugin — the same standalone-readability argument that already exempts its commented `models:`, `plan-issues:` and `strategy:` blocks. It is named as a copy artifact in the repo's `AGENTS.md` hard-gate 8 and changes together with this file. **The briefs are not copy artifacts** — they are transclusion consumers and hold no text of their own.

<!-- BEGIN git_conventions -->

## 1. Writes: prefer `gh` / the API when `.git` is read-only

In a constrained container the local `.git` can be read-only (no `git push`), and tooling like `python3` may be missing.

- **Normal environment:** plain `git` — `git commit`, `git push -u origin <branch>`.
- **Read-only `.git`:** do **not** fight the local push. Use `gh` / the GitHub REST API for the write:
  - Commit + push via the Contents API (`gh api --method PUT repos/<slug>/contents/<path>` with base64 content + `branch`), or `gh api` GraphQL `createCommitOnBranch` for multi-file commits.
  - Open the PR with `gh pr create` (or `gh api repos/<slug>/pulls`).
- Detect the case first: if `git push` fails with a read-only / permission error, switch to the `gh` path rather than retrying.

## 2. Commit author identity — from AGENTS.md `commit_identity`

The author identity is **not** ambient. It comes from the AGENTS.md `work-issue:` `commit_identity` block (`name` + `email`).

- When `commit_identity` is set, run **before every commit**:
  ```bash
  git config user.name "<commit_identity.name>"
  git config user.email "<commit_identity.email>"
  ```
- When it is absent, fall back to the ambient `git config` (no change).
- **Never** author a loop commit under a company or shared email. Use a personal identity or a GitHub noreply address (`<id>+<user>@users.noreply.github.com`).

## 3. No unconfigured co-authors (`no_unconfigured_coauthors`)

Do **not** add a `Co-authored-by:` trailer or a bot footer to any commit message or PR body — unless AGENTS.md explicitly configures one.

- Rationale: a stray `Co-authored-by:` line pulls a bot or a foreign account into the repo's contributor list. That is exactly the failure this gate prevents.
- **Scope (narrowed, #104).** The gate targets a bot or a foreign human ending up in the contributor list — an account this repo does not recognize. A trailer where every identity involved resolves to the same human is not that failure: the recurring case is a `commit_identity` mismatch against the merging account (§5), which names the same person twice under two addresses. That case does not violate this gate on its own. It is still worth avoiding — a permanent trailer is noise even when harmless — so §5's mitigation stays the default; this line only says what counts as a violation of *this* rule.
- This is a hard-gate; the Implementer and Closer briefs enforce it.

## 4. PR body conventions

- **Link the issue:** include `Closes #<num>` so the merge auto-closes it.
- **Standards block:** summarize the AGENTS.md standards used (branch pattern, syntax check, smoke test, hard gates honored).
- **Sections:** summary, test plan, loop-workflow process block.
- **No co-author lines / bot footers** in the body (same gate as §3).

## 5. Squash-merge caveat

stagecrew squash-merges PRs, and the appended `Co-authored-by:` trailer has **two distinct causes** — the fix for one does not fix the other.

- **Dirty branch commits.** GitHub appends the co-author lines from the individual squashed commits onto the squash commit. So a clean PR body is not enough — **every individual commit on the branch must already be free of `Co-authored-by:` trailers**. Keep the commits clean at author time (§2, §3); do not rely on cleaning up at merge time.
- **Identity mismatch (#104).** Even when every commit is clean, GitHub still appends a trailer whenever the account performing the merge differs from the identity that authored the branch commits — same human, two addresses, included. This happens because GitHub's *default*, auto-generated squash message lists the squashed commits' authors as co-authors whenever they differ from the merging account; it is not reading the commits for dirt, it is computing a message from two identities on one squash. Cleaning the branch commits (the bullet above) does nothing for this case, because they were never dirty.

  **Mitigation, not a gate.** The Closer may compare the branch commits' author identity against its own merging identity before merging and note a mismatch in its stage comment — a **report**, never a merge-blocking condition: attribution cosmetics are not a reason to fail a merge (see §3's narrowed scope above). The cheaper fix avoids the *trailer* outright — the two identities still differ either way, nothing closes that gap: `gh pr merge --squash --subject "<title>" --body "<body>"` supplies the squash commit message directly, which the observed mechanism above says replaces GitHub's default-generated message — the one place the co-author line is computed — rather than editing it after the fact. This is not a documented GitHub guarantee; it is the mechanism inferred from the default-message behavior above, and every merge that uses it is itself a further data point. The Closer's merge step records which happened (canonical: `skills/work-issue/SKILL.md`, Stage 5 step 4). Design record: `docs/adr/0022-squash-merge-identity-mismatch.md`.

  **The cyclical trap.** Removing `commit_identity` does not fix this — it trades a known, chosen mismatch for whatever the ambient session default happens to be, which is still generally a different address from the merging account. The mismatch moves; it does not close. The actual fix is operator-side (aligning the GitHub account's commit email with `commit_identity`, or vice versa — see the ADR above), and is out of this plugin's reach.

## 6. Non-interactive shell commands (agent-hardening)

An agent runs shell commands non-interactively — a prompt for `y/n` hangs the loop indefinitely. On many systems `cp`/`mv`/`rm` are aliased to `-i` (interactive) mode, and `git`/`gh` can open a pager or editor.

- **Always pass non-interactive flags** for file ops: `cp -f`, `mv -f`, `rm -f`, `rm -rf` (never a bare `cp`/`mv`/`rm` that may inherit an `-i` alias).
- Avoid commands that open an interactive editor/pager: set `GIT_PAGER=cat` / `--no-pager`, provide `-m` for commit messages, use `gh --json`/`-q` instead of paged output, and use `gh` flags like `--yes` where a confirmation would otherwise block.
- Interactive git flows (`git rebase -i`, `git add -i`) are unavailable — script the non-interactive equivalent.

<!-- END git_conventions -->

## See also

- `skills/work-issue/SKILL.md`, "Transcluded git/gh conventions (`{{git_conventions}}`)" — how the block above reaches a rendered brief.
- `skills/work-issue/references/subagent-briefs/code-implementer.md` / `research-implementer.md` — transclusion consumers: their commit step carries `{{git_conventions}}`, not a copy of these rules.
- `skills/work-issue/SKILL.md`, Stage 5 (Closer) — the third transclusion consumer (step 0), plus the Closer's own PR + squash-merge mechanics.
- `skills/init-agents/references/AGENTS.md.template` — the `commit_identity` field shape and the `no_unconfigured_coauthors` hard-gate entry; the declared copy artifact named above.
- `docs/adr/0012-transcluded-git-conventions.md` — why transclusion rather than a declared copy artifact.
- `docs/adr/0022-squash-merge-identity-mismatch.md` — why the identity-mismatch case in §5 is a report and not a gate, the `--subject`/`--body` verdict, and the narrowed scope of `no_unconfigured_coauthors` in §3.
