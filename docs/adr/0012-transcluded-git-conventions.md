# ADR 0012 — the git/gh conventions become one canonical file and reach the rendered briefs by transclusion, not by a declared copy

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #101
**Amends:** `skills/github/SKILL.md` (gains a canonical declaration and a delimited transclusion block), the subagent-brief render step in `skills/work-issue/SKILL.md` (gains one placeholder and a second render-input class), and hard-gate 8 in `AGENTS.md` (its enumeration reaches conventions). Supersedes nothing.

## Context

`CLAUDE.md` called the `github` skill "a convention reference (not a loop phase)" — the shared source for commit identity, the `no_unconfigured_coauthors` rule, the read-only-`.git` fallback, the PR-body conventions, the squash-merge co-author caveat and the non-interactive-shell rules. It was a source nobody read. `skills/work-issue/SKILL.md`, the file that drives every stage that commits, referenced it **not once**.

What existed instead was a restatement in every consumer. Counted by the drift test hard-gate 8 already defines — would this sentence have to change if the convention changed? — there were **14 operative restatements across 7 files**: four in `skills/work-issue/SKILL.md`, two in each Implementer brief, two in `skills/init-agents/SKILL.md`, two in `CLAUDE.md`, one in `README.md`, one in `AGENTS.md.template`. The rules were written out in full, in prose, in seven places, and the file that owns them was cited by none of the consumers that acted on them.

This is exactly what hard-gate 8 exists to prevent, and the gate did not fire. Its enumeration named "a recommendation table, preset definition or default mapping". A *rule a stage must obey* is none of those three, so nobody classified the conventions as in scope and the duplication survived every review that read the gate. The defect is the gate's vocabulary, not anyone's attention.

Removing the duplication ran into one apparent obstacle, and it turned out to be an assumption rather than a constraint. An earlier draft of #101 concluded the two Implementer briefs had to keep the rules inline, because a subagent receives a rendered brief and cannot follow a pointer into another skill mid-run. The first half of that is true; the conclusion does not follow. The briefs **already pass through a render step**: `skills/work-issue/SKILL.md` loads the brief file and substitutes `{{branch_pattern}}`, `{{commit_identity}}`, `{{git_remote}}` and the rest before dispatch. A brief that cannot follow a pointer can still be *handed the text*.

Three options were on the table:

- **Leave the restatements and declare the briefs as copy artifacts.** Honest bookkeeping, no mechanism change — and it still leaves the convention written in four places, of which the fourth is the one that gets forgotten. A declared copy is a promise that a human will remember; the record in this repo is that they do not.
- **Point and hope.** Replace the inline rules with "see the `github` skill" in the briefs too. This is not de-duplication, it is deletion: the subagent has no way to resolve the pointer, so the rules simply stop reaching the stage that must obey them.
- **Transclude.** The brief stores a placeholder; the orchestrator fills it from the canonical file at dispatch time.

## Decision

**`skills/github/SKILL.md` is the canonical source for the git/gh interaction conventions, and the rendered briefs receive them by transclusion through a `{{git_conventions}}` placeholder. No copy artifact is created.**

After this change the operative rules exist in **exactly one file**. Every other mention in the repo is a pointer, a placeholder, or the one declared template copy described in §4.

### 1. Transclusion over a declared copy — because it removes the failure mode instead of documenting it

A declared copy artifact makes drift *visible*; transclusion makes it *impossible*. The rendered brief carries the current text by construction, because the text is read from the canonical file at the moment of dispatch. There is no fourth place to forget, no two-files-change-together discipline to enforce, and no review step that has to catch a half-applied edit.

That is the plugin's own principle applied to the plugin: everything points at one source, and only that source is edited. A repo whose whole purpose is enforcing single-source discipline in other repos does not get to hold a declared quadruplicate of its own conventions.

The mechanism costs nothing new. `{{git_conventions}}` is one more entry in a substitution list that already fills thirteen placeholders — the render step itself is untouched, which the issue required.

### 2. The source is a new render-input class, and it is named as one

Every existing placeholder is filled from the **AGENTS.md cache + state tracker**: per-repo values that vary by repo, which is why they live in the target repo. `{{git_conventions}}` is filled from a **file that ships inside the plugin**, which no placeholder did before.

That is the correct axis, and it is the reason the two classes are documented separately rather than as one list with an extra entry: conventions that are identical in every repo belong to the plugin; values that differ per repo (`commit_identity`, `branch_pattern`) belong to that repo's AGENTS.md. Collapsing them into one undifferentiated "placeholders are substituted from the cache" sentence is what would make the next reader put the next plugin-global rule in the wrong place.

Three sentences in `skills/work-issue/SKILL.md` and the Placeholders line of each brief asserted the old, narrower rule. This change **falsified all five**, and all five are amended in the same diff — the case ADR 0011's out-of-diff falsification check was written for, caught on the way in rather than after the fact.

### 3. Resolution is skill-relative, and the extent is a delimited block

**Path.** The render step reads `../github/SKILL.md`, relative to its own skill directory. There is no `CLAUDE_PLUGIN_ROOT` in this repo and no reference to the plugin cache path anywhere in it; inventing either would be a change to the render mechanism, which #101 puts out of scope. Skill-relative is the existing precedent — `skills/work-issue/SKILL.md` already reads `../init-agents/references/AGENTS.md.template`, and `skills/loop/SKILL.md` reads `../CLAUDE.md`. It also resolves identically in a local development checkout and in an installed version cache, because both preserve the plugin's directory layout.

**Extent.** The canonical file marks the injectable region with `<!-- BEGIN git_conventions -->` / `<!-- END git_conventions -->`, and the render step injects that block and nothing else. A delimited block was chosen over a named-section list because a section list is a second place that has to be updated when a section is added or renamed — the same drift this ADR is about, reintroduced in the transclusion contract. A marker pair moves only when someone deliberately moves it.

What the markers exclude is deliberate: the YAML frontmatter is loader metadata a subagent must not receive, and the "Canonical source" and "See also" sections point **back at the briefs** — a circular reference inside a rendered brief, which is precisely the failure a whole-file transclusion would ship.

**The block is §1–§6 in full, not a subset.** Three of those sections were not previously restated in either brief: §1 (read-only `.git` → `gh`), §4 (PR-body conventions) and §6 (non-interactive-shell hardening — no pager, no interactive rebase, no destructive cleanup — which binds every stage that runs shell commands, not only one that pushes). Injecting them **adds** instruction rather than removing duplication, and that is a deliberate choice. §1 is directly load-bearing — the Implementer's push step is a bare `git push`, which is the exact command that fails in a constrained container, and the brief had no fallback. §6 is load-bearing for the same reason at one remove: both Implementers run shell commands, so the hardening rules bind them directly even though they were written with the pushing stage in mind. §4 costs a rendered brief four lines and is inert for a stage that creates no PR — the consumer's lead-in says so explicitly, so an Implementer never reads it as licence to open one. The alternative — a per-consumer subset, one marker pair per audience — reintroduces per-consumer variance, which is the thing transclusion was chosen to remove. One block, one extent, every consumer gets the same text.

### 4. `AGENTS.md.template` stays a copy — and is declared, not left undeclared

The template restates the `no_unconfigured_coauthors` rule in the comment beside its `hard_gates` entry. Nothing renders that file, so transclusion is unavailable to it, and it is read standalone by a human inside a *foreign* repo where no path resolves back into this plugin. That is the same standalone-readability argument that already exempts its commented `models:`, `plan-issues:` and `strategy:` blocks.

The alternative — turning the comment into a pointer — makes the template worse in the one situation it exists for: a person reading a generated AGENTS.md in their own repo, with the plugin nowhere in sight.

So it stays, and hard-gate 8's enumeration is corrected to **name it**, because the gate requires every permitted copy to be declared at the canonical source and in `AGENTS.md`. The three existing advice copies are unchanged; this fourth is a copy of a *convention*, and it becomes enumerable only now that the gate's wording reaches that class. Declaring it is the point: an undeclared copy is the state this ADR is fixing, and leaving this one undeclared while fixing the others would be the same defect with better paperwork.

**The briefs are explicitly not copy artifacts.** They hold a placeholder and no text, so there is nothing to drift and nothing to enumerate.

### 5. Hard gate 8 reaches conventions

The enumeration gains "convention (any rule a stage must obey)" and names `skills/github/SKILL.md` as its canonical file, alongside the model presets and the label contract. Without this the gate stays blind to the class of defect this ADR repairs, and the next convention to acquire a second consumer gets copied for the same reason as the last one.

The gate also gains the distinction the mechanism creates: **transclusion is not duplication**, and a placeholder filled at render time is never a copy artifact. And a *gate name* in a `hard_gates` list is not a copy of the rule behind it — only the sentence explaining what it forbids is. Without that clause the extended gate would flag every `hard_gates` entry in the repo.

## Consequences

**For the repo:** the operative rules exist in one file. Fourteen restatements across seven files become pointers, one placeholder in three rendered briefs, and one declared template copy. Changing a git/gh convention is now a one-file edit, and every rendered brief picks it up on the next dispatch with no second edit anywhere.

**For a loop run:** the Implementer and Closer briefs grow by the transcluded block. Both stages gain §1, §4 and §6, which they did not carry before — the Implementer in particular now knows what to do when `git push` fails on a read-only `.git`, which it previously did not, and both Implementers now carry the non-interactive-shell rules their own shell steps depend on.

**For a consumer repo:** nothing changes. No AGENTS.md field is added, reinterpreted or made mandatory; the conventions themselves are untouched, only their location moved. A repo that upgrades gets briefs whose git section is rendered rather than hardcoded, and identical behaviour.

**Accepted cost — a new failure mode, and it is handled explicitly.** The render step can now fail on a *missing file* rather than only on a missing value: a moved file or a deleted marker leaves `{{git_conventions}}` unfilled. The rule is to **STOP before dispatching** and never to fill the placeholder from memory — a remembered paraphrase is exactly the copy this mechanism exists to prevent, and it would be an invisible one. This is strictly better than the previous state, where the same drift was silent and permanent instead of loud and immediate.

**A boundary, stated so it is not mistaken for an omission.** The Visual Reviewer brief carries no placeholder. That stage never commits, pushes or opens a PR, and injecting conventions it cannot act on would be instruction bloat, not consistency.

## Migration

None required, for this repo or for any consumer repo. No AGENTS.md field is added or changed, no default is flipped, and no existing configuration becomes invalid.

Within this repo the migration is the diff itself: the restatements are removed in the same commit that introduces the placeholder, so no window exists in which a brief renders without the rules. A `claude restart` is required after the merge, as it is after any `SKILL.md` change — otherwise the stale cached version keeps rendering the old briefs.

For an editor arriving later: change a convention **only** in `skills/github/SKILL.md`, inside the marker pair. Adding a section inside the markers adds it to every rendered brief; adding one outside them adds it to nobody. Moving a marker changes what every committing stage receives and belongs in its own PR body.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). The briefs that stages actually receive change, and the render step gains an input class it did not have. No AGENTS.md field becomes required, no existing field is reinterpreted, no default is flipped, and no consumer repo has to change anything to keep working. Not `patch` — in this plugin the Markdown is the runtime, and a stage's briefing now contains sections it did not contain before. Not `major` — no caller breaks, and under 0.x there is no `major` bump in any case.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this is a behaviour change to a skill, the same self-application ADRs 0009, 0010 and 0011 record.
