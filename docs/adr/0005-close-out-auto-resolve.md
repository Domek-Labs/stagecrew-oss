# ADR 0005 — `/close-out` may resolve additive conflicts, behind an opt-in that defaults to off

**Status:** accepted
**Date:** 2026-07-31
**Issue:** #34
**Supersedes:** nothing. **Amends:** the constraint list in `skills/close-out/SKILL.md`, "What this skill does NOT do".

## Context

`/close-out` has advertised additive-conflict auto-resolution since it shipped — in its own frontmatter, in `CLAUDE.md`, in `skills/loop/SKILL.md` and in §3 of its own SKILL. (`README.md` never mentioned it; it only ever claimed the ordered wave merge.) It could not do it, for two independent reasons:

1. **The detection procedure did not detect.** §3 ran `git merge-base` and `git diff --name-only`, which list changed file names. Neither says anything about whether two branches conflict: a file can appear in that list and merge cleanly, and two branches can both touch a file with no conflict at all. There was no trial merge, so there were no conflict hunks, so the additive/non-additive decision the section went on to describe had no input.
2. **The skill forbade itself the mechanism.** "Does not write code or modify source files / Does not create new branches or worktrees / Does not push commits". Resolving a conflict means writing the merged file, committing it and pushing so the PR becomes mergeable. The feature and the constraint were mutually exclusive.

So the capability was documented in four places and implemented in none. Under the default `merge_policy: defer` (ADR-0004) `/close-out` is now the merge point for every loop, which makes a wave that collides either stall or — worse — get reported as auto-resolved when nothing happened.

## Decision

**Implement the capability, and gate it behind `close-out.auto_resolve`, which defaults to `false`.**

Two decisions, taken separately.

### 1. Implement rather than delete the promise

The alternative was to delete the claim from all four places and have `/close-out` detect, report and defer to a human. Rejected: under `defer` the ordered wave merge is the skill's reason to exist, and a skill that stalls on every real collision loses most of that value. The promise was reasonable; only the implementation was missing.

The permitted write is therefore narrowed to the smallest useful one and defined mechanically (§3.3): additive iff, for every conflicted path, both sides only added lines and their added-line sets do not intersect. Everything else — including anything an agent finds itself *reasoning* about — is non-additive and goes to a human. The two failure modes are not symmetric: a wrong "additive" silently corrupts a merge and then deploys it, a wrong "non-additive" asks a question. The rule biases hard to the second.

`/close-out` may now create a **scratch worktree** and push a resolution to an **existing PR branch**. It still may not: create feature branches, write source beyond the mechanical union, push to `pr_base`, force-push, or touch any other ref.

### 2. Default off, opt-in per repo

`version_policy`'s `minor` rule permits a documented default flip only with an ADR **and** an opt-in that preserves the old behaviour. That framing prompted the real question: should this be a flip at all?

It should not. The constraint being relaxed — *"does not push commits"* — is a **safety guarantee about what the plugin does to a user's repository**, not a defect. That distinguishes it from ADR-0004, where the old default (the Closer merging on APPROVE, in completion order, defeating wave ordering) was demonstrably broken, and where an opt-in preserving it was rejected *because* preserving a broken default has no value. Here the old behaviour is the conservative one and has obvious value.

So `auto_resolve` defaults to `false`, and with it this change flips no default in the part users relied on: nothing is written, committed or pushed unless someone sets the field. A repo that wants unattended resolution opts in once.

**One change is unconditional and is recorded rather than glossed:** the detection trial merge registers a detached scratch worktree in the repository under either setting, because knowing whether a conflict is additive is worth reporting even when nothing will be resolved. Every earlier guarantee list said "does not create new branches or worktrees", so that one clause no longer holds by default. It is torn down on every exit path, a failed removal is reported, and no branch ref is ever created — but it is a real difference, and the honest framing is that the *write* guarantees are preserved while that one *workspace* guarantee is not. `version_policy`'s `minor` rule explicitly tolerates a change that "MAY break edge-case setups"; this is one, and this ADR is the record of it.

Consequence accepted: the frontmatter and docs must describe the capability as available *when enabled* rather than as unconditional. That is the honest description either way.

## Consequences

**For existing users:** no field to set, no flag, and §3 still changes no repository content — no file edit, no commit, no push, no branch ref. Three default-path effects are new or newly named: the detection fetch (remote-tracking refs, `FETCH_HEAD`, objects), the detection scratch worktree, and a comment on a conflicted PR instead of a silent skip. The third is externally visible and notifies subscribers; it is deliberate, because a silent skip is what let the old `/close-out` report success while doing nothing.

**For a repo setting `auto_resolve: true`:** one `/close-out` invocation authorises resolve → push → merge → deploy, unattended, with no automatic revert (the Closer's constraint, inherited). Consent is at invocation time, not per conflict. Mitigations, all in §3:

- The union is mechanical and the classification is a deterministic read of three blobs — no model judgement.
- Deletion counts are read with `--numstat`, never by pattern-matching a diff body. A removed line whose text begins with `-` renders as `--…` and is invisible to a leading-dash test; a union built on that misreading **resurrects content a merged wave deliberately removed**.
- Any intersection of the two sides' added lines is non-additive: whether an overlapping union duplicates the shared line depends on internal diff alignment, so the result is not predictable by reading the two sides.
- A `.gitattributes` `merge` attribute other than the default makes a path non-additive — the owner's declaration that a path must not be text-merged, which `merge-file --union` would otherwise ignore.
- The PR head must be a same-repo branch matching `headRefOid`; a fork PR would otherwise have a resolution pushed to a *newly created* branch in the target repo.
- The commit identity is applied per-commit with `-c`, never `git config` — which in a linked worktree writes the repository's shared config and survives teardown.
- Every resolution posts a PR comment carrying the resulting hunk, so the decision is auditable rather than buried in a merge commit.
- A pushed resolution invalidates every CI result read before it; the base-vs-PR baseline gate re-runs on the new head, and a PR still awaiting CI counts as **skipped**, which suppresses the deploy for that run. An auto-resolution can therefore never produce a half-integrated deploy.
- Scratch worktrees are torn down on every exit path, and no merge ever runs in the user's own checkout.

**Not covered:** additions that are individually valid but jointly wrong in a way no textual test can see — two different lines that collide semantically. That is out of scope by construction; the mitigation is the wave planner not putting semantically coupled work in one wave.

## Migration

None required. To enable:

```yaml
close-out:
  auto_resolve: true
```

To go back, set it to `false` or remove it.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). Changed skill behaviour, backwards-compatible for existing AGENTS.md files: no field is required, no schema is reinterpreted, and the default preserves the write guarantees. Not `patch` — in this plugin the Markdown is the runtime, and this adds git commands the skill did not previously run. Not `major` — no default is flipped and no caller breaks; under 0.x there is no `major` bump in any case.
