# ADR 0021 — one transcluded delegation rule for every stage that can spawn, and a spawn record limited to what a stage can observe

**Status:** accepted
**Date:** 2026-09-03
**Issue:** #122
**Amends:** the subagent-brief render step in `skills/work-issue/SKILL.md` (gains a second plugin-internal placeholder and its own STOP-before-dispatch failure mode), the stage-comment contract in the same file (gains one conditional line above the audit line), the three files under `skills/work-issue/references/subagent-briefs/` (each loses its inheritance note and gains the placeholder), `CLAUDE.md` (gains the operator-side caps) and the `Model Selection` → `Loop integration` bullet in `AGENTS.md` (becomes a pointer). Extends `docs/adr/0012-transcluded-git-conventions.md` with a second transclusion consumer class; keeps the requested-never-ran vocabulary of `docs/adr/0017-per-stage-effort-axis.md`. **Supersedes in part** the "Nested subagents" section of `docs/adr/0003-model-selection.md`, whose "documented in all three subagent briefs" is no longer the arrangement; a supersession note is added there rather than the section being rewritten.

## Context

Every stage of `/work-issue` runs as a subagent, and a subagent can dispatch subagents of its own. Four files said so, in four near-identical paragraphs:

```
$ grep -rn "Nested subagents do NOT inherit" . --include=*.md
skills/work-issue/SKILL.md:578
skills/work-issue/references/subagent-briefs/code-implementer.md:9
skills/work-issue/references/subagent-briefs/research-implementer.md:9
skills/work-issue/references/subagent-briefs/visual-reviewer.md:11
```

Two facts about those four sites decided this change, and both are re-checkable from a clone.

**They documented the mechanic and none of the judgement.**

```
$ grep -rnic "delegat" skills/work-issue/SKILL.md skills/work-issue/references/subagent-briefs/*.md
skills/work-issue/SKILL.md:0
skills/work-issue/references/subagent-briefs/code-implementer.md:0
skills/work-issue/references/subagent-briefs/research-implementer.md:0
skills/work-issue/references/subagent-briefs/visual-reviewer.md:0
```

Zero hits. Nothing anywhere in this plugin told a stage *when* a nested spawn is worth making, and nothing bounded how many there might be. That was survivable while models delegated reluctantly; it is not a safe default any more.

**And they sat where no stage ever read them.** In the three brief files the note was header matter — above the `---`, above `## Briefing (template)`, in the part of the file the render step never dispatches. In `skills/work-issue/SKILL.md` it was prose in the model/effort section, inside no briefing at all. Compare `{{git_conventions}}`, which sits on a blockquote line **inside** the briefing (`code-implementer.md:61`) and therefore reaches the stage. A subagent receives a rendered brief and nothing else; text outside the briefing is text the stage never sees.

Those two observations are the whole argument for putting the rule in the brief, and they are the reason this ADR makes no claim about how Claude Code assembles its own prompts. An earlier draft of #122 argued from a named system-prompt preset that governs when Claude Code injects its own delegation instruction. That preset appears in no Claude Code documentation; the documentation check on the issue could not confirm it, and it is **not** recorded here in any form, hedged or otherwise. The in-repo greps above reach the same conclusion and can be re-run by anyone.

Cost is the reason the record matters. A stage that fans out is invisible to the stage comment, to the state tracker and to the audit line: the thread records what the *stage* ran on, never what its children cost. A five-stage loop with an eager Implementer can spend a multiple of what its recorded model suggests, with nothing in the issue thread showing it — the same argument that put `model:` on the comment in the first place.

## Decision

**One canonical delegation rule, transcluded into every stage briefing that can spawn; a conditional delegation line that records only what the stage itself can testify to; the deterministic caps documented as the operator's, not implemented as the plugin's.**

### 1. One rule, transcluded — not a paragraph per brief

Hard gate 8 decides this before preference does. "When is a nested spawn warranted" is *a rule a stage must obey* — exactly the class the gate's enumeration was widened to reach in ADR 0012. Per-brief paragraphs would be copies by the gate's own drift test: each would have to change when the rule changes.

The four existing notes were already a breach of that kind — four restatements of one convention, differing only in a parenthetical example. Folding them into one block does not merely keep the new text clean; it removes a standing violation.

The mechanism is ADR 0012's, unchanged in shape: a delimited block, whole-line marker matching, injection strictly between the markers, re-indentation to the consumer's quote level, and STOP before dispatch when a marker does not resolve to exactly one whole line. Consumers hold the placeholder and **no text of their own** — not a summary, not a gloss, not a "see also" — which is what makes drift impossible rather than merely visible.

Two things differ from `{{git_conventions}}`, and both are deliberate:

- **The canonical home is `skills/work-issue/SKILL.md` itself**, not a new file under `references/`. `/work-issue` owns both the stages that spawn and the render step that fills the placeholder; a separate file would be a second hop for nothing. It is not `skills/init-agents/references/model-presets.md` either — that file is canonical for *which tier per stage*, a different rule, and it must not grow a second subject.
- **The decoy hazard is sharper.** The block and the prose describing it now live in one file, so an unanchored first-occurrence search has the mechanics section itself to trip over. The mechanics therefore never reproduce a full marker comment on any line, and say so.

**Consumers: eight rendered surfaces** — the three brief files and the five inline stage briefings. No stage in this loop is structurally barred from spawning. The Visual Reviewer is explicitly included: ADR 0012 excluded it from `{{git_conventions}}` because it never commits, and that reason does not transfer. One child per route × viewport is the textbook eager-delegation shape, and a stage second-guessing its own reading of a screenshot is the self-verification case the rule forbids.

**Six statements became false** the moment a second plugin-internal placeholder existed, and all six are corrected in the same diff. Four were uniqueness claims found on the way in — the case ADR 0011's out-of-diff falsification check exists for. The remaining two were found later and are recorded here because the count matters more than the credit: `AGENTS.md:361` was corrected by the Implementer without being counted, and the Visual Reviewer's render instruction at `skills/work-issue/SKILL.md:782` was **missed entirely** and caught by the Tester — its Stage 2 counterpart had been amended while it was not, so following it literally would have dispatched an unsubstituted placeholder, which this file forbids.

### 2. The delegation line records what the stage can observe, and nothing else

This is where #122's spec was narrowed, and the split is not arbitrary.

**The count is first-hand.** A stage issues its own dispatches, so it knows how many it made the same way it knows how many files it edited. That is direct self-observation, and it is what makes the visibility half of this issue implementable at all.

**The child's model is not.** A stage that spawns a child without a model parameter cannot name what that child ran on: it knows its own resolved alias — which may itself be `inherited` — and the session model behind that is not exposed to it. Recording "which model they fell back to", as the issue originally asked, would be a fabricated audit line, the same defect class ADR 0017 forbids for effort.

**Grandchildren are not either.** A child that spawns its own children is invisible to the stage, so a count presented as a total would be a false total.

The line therefore carries the number **dispatched directly** and the alias the stage **passed** — or `none` — in ADR 0017's requested-never-ran vocabulary, so the two records read alike.

### 3. A separate conditional line, above the audit line — the audit line is not extended

The audit-line grammar says "exactly one line, in exactly this shape" and enumerates five rendered forms. Extending it would force every stage to render a delegation half, which makes "a stage that does not spawn adds no line" unmeetable. So the delegation line sits immediately **above** it: the audit line stays last, its grammar and its five forms untouched, and only the sentence scoping "exactly one line" is reworded so it binds the audit line rather than the comment's tail.

A stage that dispatched nothing writes nothing at all — not `delegation: 0`. That is the silent-when-empty posture the `strategy.gates` consistency report already uses, and the alternative would put a line reading zero on every comment in every loop forever.

### 4. Both axes stay distinct — no "inherits nothing" flattening

The two axes fail for different reasons and the block keeps them apart:

- **model** — a real dispatch parameter that is **not propagated**; a nested spawn falls back unless the stage passes it explicitly;
- **effort** — **not a dispatch parameter at all**, so there is nothing to inherit and nothing to pass.

Collapsing these into "nested spawns inherit nothing" would imply effort is dispatchable but merely uninherited — the exact misreading the "resolved and recorded, never dispatched" section exists to prevent. **If the dispatch ever gains an effort parameter, this block is one of the sites that changes**, alongside the ones ADR 0017 already names.

### 5. The caps are documented, not implemented

Claude Code documents two environment variables that bound spawning — `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (default 3 layers below the main conversation) and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (default 20) — both settable in `settings.json` under `env`. They are the only documented mechanism that caps spawning, and `CLAUDE.md` names them, their effects and their defaults, citing <https://code.claude.com/docs/en/sub-agents.md>.

**No version number ships.** The issue asked for a minimum Claude Code version to be documented as a requirement; the public changelog does not name it, nobody here could confirm it, and an unverifiable requirement in a skill file is worse than none. The defaults and the documentation URL are checkable; a version we cannot verify is not. This also keeps hard gate 6 clean — only `.claude-plugin/plugin.json` names a version of anything.

**The plugin does not set them**, and nothing in the skills claims to enforce a cap. A skill is text; enforcement is the harness's. The loop declares what it needs and leaves the container to the operator — the same posture the time budgets and the companion MCPs take.

### Alternatives rejected

- **A delegation paragraph in each brief** (the issue's spec item 1). Rejected on hard gate 8: four copies of one rule, drifting the first time the rule is edited — and it would have preserved the existing four-way breach rather than removing it.
- **Extending the `model:`/`effort:` audit line with a delegation half.** Rejected: it breaks the "exactly one line, exactly this shape" contract and makes a silent non-spawning stage impossible.
- **Recording the model a child fell back to** (the issue's spec item 3, as written). Rejected as unobservable — see §2.
- **Carrying the system-prompt-preset claim labelled unverified**, in the shape #111 used for the App-access evidence. Rejected: that shape is for a load-bearing claim with **no observable substitute**. Here there is one, and it is stronger — the in-repo greps in Context. Re-adding a hedged mechanism claim to a live prompt surface would also reverse the strip-the-archaeology work that landed immediately before this.
- **Enforcing a spawn cap from inside the skill.** Not rejected so much as impossible; recorded because the issue names it out of reach and a later reader should find the reason, not just the absence.

## Consequences

**For the repo:** the nested-spawn rule exists in exactly one place. Four near-identical notes become one delimited block and eight placeholder lines. Editing the rule is a one-file edit that every rendered briefing picks up at the next dispatch, and there is no fourth site to forget.

**For a loop run:** every stage now receives delegation guidance *inside* its briefing, where the old note never was — a change in what stages are told, not only in where the text lives. A stage that fans out leaves a trace in the thread; a stage that does not is unchanged, comment for comment.

**For a consumer repo:** nothing to do. No AGENTS.md field is added, removed or reinterpreted, and no existing configuration becomes invalid. An operator who wants a hard bound sets two environment variables that were always available and are now merely findable.

**Accepted cost — a second render-step failure mode.** The dispatch can now STOP on an unresolvable `{{delegation_rule}}` as well as on an unresolvable `{{git_conventions}}`. That is the same trade ADR 0012 accepted: loud and immediate beats silent and permanent, and the rule against filling a placeholder from memory is what keeps it that way.

**A known limit, stated so it is not mistaken for an omission.** The delegation line is self-reported and covers direct children only. A stage that dispatches children and declines to write the line leaves no trace, and a grandchild is invisible either way. This buys visibility, not accounting; the deterministic bound is the operator's variables, not this record.

## Migration

None required, for this repo or any consumer repo. No AGENTS.md field changes, no default flips, no existing configuration becomes invalid.

Within this repo the migration is the diff: the four notes are deleted in the same commit that introduces the block and the placeholders, so no window exists in which a brief renders without the rule. A `claude restart` is required after the merge, as after any `SKILL.md` change.

For an editor arriving later: change the rule **only** inside the marker pair in `skills/work-issue/SKILL.md`. Text added inside the markers reaches every rendered briefing; text added outside them reaches nobody. Moving a marker changes what every stage receives and belongs in its own PR body.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). Skill behaviour changes and stays backwards-compatible: the briefings stages receive gain a rule they did not carry, the stage-comment contract gains a conditional line, and the render step gains a placeholder that can STOP a dispatch. Not `patch` — in this plugin the Markdown is the runtime, and the plugin's behaviour depends on all three. Not `major` — no AGENTS.md field is added, removed or reinterpreted, no caller breaks, and under 0.x there is no `major` bump in any case.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this is a behaviour change to a skill.
