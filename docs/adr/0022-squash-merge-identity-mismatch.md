# ADR 0022 — a squash-merge identity mismatch is a Closer report, not a gate; `--subject`/`--body` is the adopted mitigation; `no_unconfigured_coauthors` is narrowed to what it protects against

**Status:** accepted
**Date:** 2026-09-15
**Issue:** #104
**Amends:** `skills/github/SKILL.md` (§3 scope note, §5 rewritten for two trailer causes), `skills/init-agents/references/AGENTS.md.template` (the declared copy of the §3/§5 note), `skills/work-issue/SKILL.md` (Closer step 4 gains the identity check + `--subject`/`--body`; new "Squash-merge identity check" section; a pointer added under "Closer merge behavior"), `CLAUDE.md` (the Closer's rule count moves from three to four).

## Context

A squash-merge on `dev` appends a `Co-authored-by:` trailer whenever `commit_identity` is declared in AGENTS.md and the merging GitHub account commits under a different address. Measured on `dev` on 2026-09-15 (`git log --format='%h|%an|%ae' -15`, trailer counted per commit): `1cfaf4d` — the commit that (re-)declared `commit_identity` in #137 — carries one; the 14 commits below it, all authored under the GitHub account's default address, carry none.

```
$ git log -1 --format='%H%n%an <%ae>%n%B' 1cfaf4d
1cfaf4dd8c79b7ec0ee936b7109863ef508b1f2a
domek <the account's primary address>
chore(agents): declare per-stage models and commit_identity (#137)
...
Co-authored-by: Dominik Scheinecker <269312923+domek-at@users.noreply.github.com>

$ gh pr view 137 --json commits --jq '.commits[].authors[].email'
269312923+domek-at@users.noreply.github.com
```

The branch commit was authored under `commit_identity`'s address (clean — no trailer of its own). The squash **merge** commit is authored under the GitHub account's ambient address, and the address that authored the branch commit shows up as a `Co-authored-by:` line on the merge commit. **This is the root cause, and it is not a dirty-commit problem**: §5, as it read before this change, told the Implementer to keep every individual commit trailer-free — which it already was. The mismatch is between the branch commits and the identity performing the merge, a place no stage looked at.

**The condition is cyclical.** `commit_identity` was present, then absent (2026-09-10), then re-declared by #137 (2026-09-11). Each state flips the symptom: present → the trailer returns on the next squash-merge; absent → the loop commits under whatever the container's ambient default happens to be, which is not necessarily the merging account's address either. Removing the field is therefore not a fix — see Decision 1 below for why the alternative is not a fix in the other direction either, and the actual fix is outside this plugin (see "Operator-side remedy").

**Severity, honestly stated.** No bot and no foreign account is involved — it is the same human under two addresses. The harm `no_unconfigured_coauthors` exists to prevent (pulling a bot or a stranger into the contributor list) is not occurring here. But the letter of the gate as previously worded is violated on every merge that follows a declaration, the noise is permanent in history, and a rule tripped without anyone noticing has stopped functioning as a signal (the failure mode #99 names for a different rule).

## Decision

Three decisions, taken together because each depends on the others' reasoning.

### 1. The Closer reports the identity mismatch; it never gates the merge

A gate here is the wrong instinct. The Closer's terminal verdicts are `merged` (& deployed) or `ESCALATE: CI pending` — both defined in "Closer merge behavior" — and neither has a slot for "declined to merge because the diff and the account attribution look different." A merge failing over attribution cosmetics would be strictly worse than the noise it prevents: it would turn a cosmetic trailer into a blocked deliverable, on a condition (the operator's own account vs. the operator's own configured identity) that has nothing to do with code quality, CI state, or review outcome.

So the Closer's new step 4 sub-step reads both identities (branch commits' author emails vs. the account about to perform the merge) and **notes** match or mismatch in the stage-10 comment. It is deliberately the same posture as the CI base-vs-PR baseline's "pre-existing failure" note and the drift-check warning in step 6: information for whoever reads the thread next, never a precondition on reaching the terminal verdict.

### 2. `--subject`/`--body` is adopted, on an inferred mechanism, verified going forward

`grep -rn '\-\-subject' skills/` returned no hit before this change — the mitigation was written down nowhere. `gh pr merge --squash` accepts `-t/--subject` and `-b/--body`, which map to the GitHub API's `commit_title`/`commit_message` parameters on the merge endpoint.

**What we could establish without contacting GitHub from this container** (the loop's access is GitHub-only, and confirming API semantics from a live experiment was not available inside this stage): the trailer that appears on `1cfaf4d` is not a static annotation of "this PR had N authors" — it is part of the **default, auto-generated** squash message GitHub computes when the caller does not supply one. The GitHub squash-merge UI's own pre-filled commit-message textbox is exactly this generated text, edited in place before confirming; a caller that supplies `commit_title`/`commit_message` explicitly is providing that text directly rather than accepting GitHub's generated one.

**Verdict: adopted**, on that inferred mechanism, with the honesty the issue asked for: this is not a documented GitHub guarantee, and no live squash-merge inside this loop's evidence trail has confirmed it end to end yet. The Closer's own step 4 now supplies `--subject "<pr title>" --body "<concise summary>"` on every squash-merge and immediately reads the resulting merge commit's message back (`git log -1 --format=%B <sha> | grep -c '^Co-authored-by:'`), recording the count in its stage comment. **The next several Closer runs are the verification** — including, concretely, the merge that closes issue #104 itself, whose own merge commit is evidence for or against the mechanism this ADR adopts. If a future run's evidence contradicts the mechanism, the record to revise is this ADR and `skills/github/SKILL.md` §5, not a silent workaround somewhere else.

**Rejected alternative — match the merging identity to the branch identity.** The Closer could `git config user.email` to `commit_identity`'s address before merging. Rejected: `gh pr merge` performs the merge through the GitHub API under the authenticated account's identity regardless of local `git config` — the merge is not a local commit the Closer authors, so this alternative does not actually reach the mechanism that produces the trailer. `--subject`/`--body` acts on the one thing the Closer's API call actually controls: the message GitHub uses.

### 3. `no_unconfigured_coauthors` is narrowed to what it protects against

The gate's own rationale, unchanged by this ADR, is: "a stray `Co-authored-by:` line pulls a bot or a foreign account into the repo's contributor list." A same-human, two-address trailer does not do that — the contributor list gains no new identity, foreign or otherwise. Left absolute, the wording keeps calling this repo's own recurring, harmless case a violation, and a rule that a repo tracking it keeps tripping teaches its readers to discount it — the exact failure #99 already named for a different rule, and the reason this repo declines to let it happen twice.

**Verdict: narrowed, not declared out of scope.** `skills/github/SKILL.md` §3 gains a scope note: the gate targets an account this repo does not recognize; a trailer where every identity involved resolves to the same human is not, by itself, a violation. This is deliberately **not** "the trailer is out of scope" full stop — §5's mitigation (the identity report + `--subject`/`--body`) stays the default, because a permanent trailer is still noise worth avoiding even when it is harmless. Narrowing changes what counts as a violation of *this* rule; it does not change whether the trailer is worth avoiding.

The declared copy in `skills/init-agents/references/AGENTS.md.template` changes with §3 in the same diff, per hard gate 8.

## Operator-side remedy (named, not performed)

The concrete fix for *this* repo is a configuration change outside the plugin: align the GitHub account's commit email with `commit_identity`'s address, or vice versa, so the branch commits and the merging account agree. That is explicitly out of scope for this change (see the issue's Out of Scope) and is not performed here. **Naming it does not make the plugin change complete on its own** — a consumer repo that never performs this alignment still hits the identity-mismatch case on every merge, which is exactly why Decisions 1–3 exist: the report, the `--subject`/`--body` mitigation and the narrowed gate all hold with or without the operator ever making this change.

## Consequences

**For this repo and every consumer repo with `commit_identity` set:** the Closer's squash-merge now supplies an explicit message and reports the identity comparison; neither can block a merge. A repo that never sets `commit_identity` sees no behavior change — there is only one identity to compare against itself, trivially a match.

**For `no_unconfigured_coauthors`:** a same-human trailer no longer counts as tripping the gate. A bot or foreign-account co-author still does, unchanged.

**Known limit.** The `--subject`/`--body` mechanism rests on an inferred read of GitHub's behavior, not a cited guarantee. If a future merge's evidence shows the trailer still appends with an explicit message, the fix is a smaller, structurally identical ADR revising the mechanism note in `skills/github/SKILL.md` §5 — the report-not-gate and narrowed-scope decisions do not depend on the mechanism succeeding, only the "avoid it" branch's effectiveness does.

**Not addressed here, on purpose:** rewriting existing merge commits (history stays as it is), changing the squash-merge strategy itself, performing the operator-side account/email alignment, and removing `commit_identity` — each explicitly out of scope on the issue.

## Migration

None required. No AGENTS.md field is added, removed, or reinterpreted; `commit_identity`'s shape is unchanged. A `claude restart` is required after this merge, as after any `SKILL.md` change (both `skills/github/SKILL.md` and `skills/work-issue/SKILL.md` change here).

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). This changes Closer skill behavior — a new non-blocking step and a changed squash-merge invocation — while staying backwards-compatible for every existing AGENTS.md: no field is added or reinterpreted, and a repo without `commit_identity` sees no behavior change. Not `patch`: the Markdown here is the runtime, and the Closer's actual merge invocation changes. Not `major`: no field is removed, no default flips in a way that breaks a caller, and under 0.x there is no `major` bump in any case.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this is a behavior change to a skill.
