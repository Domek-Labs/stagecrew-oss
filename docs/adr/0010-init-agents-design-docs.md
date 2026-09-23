# ADR 0010 — `/init-agents` becomes design-doc aware: consume a PRD, or capture its essence in the body — never scaffold a second one

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #93 (depends on #90)
**Amends:** ADR 0008 — §3 ("design docs are captured in the AGENTS.md body, not reconstructed as documents") stops being a principle stated in a schema and becomes a dialog in the bootstrap. Supersedes nothing.

## Context

ADR 0008 introduced the `strategy:` block and ADR 0009 made its gates act. Both left the block **unreachable at the only moment a repo's standards are actually decided**: `/init-agents`. A repo got a `strategy:` block by someone reading a schema description and hand-editing YAML — which means, in practice, that repos which most need the strategic posture never get it.

The gap is worse for the repos the posture was invented for. A client project usually arrives with a PRD and an SDD; there the block is a pointer and the decision is trivial. The hard cases are the ones with no documents at all — a takeover, a small internal tool, a prototype — and those are exactly the repos where architecture, non-goals and the test bar are decided implicitly, by whoever commits first.

Two failure modes bound the design space, and both have precedent in this plugin:

- **Ask for a document and get one.** If the bootstrap offers to scaffold a PRD, most repos will end up with a generated PRD nobody reads. That is the described-documentation failure mode ADR 0008 §3 already named and the `docs_command` section already warns about: content that can go wrong silently, because nothing depends on it. A second version of the truth drifts from the first, and the drift is invisible.
- **Ask nothing and get nothing.** Leaving the block to hand-editing keeps the schema honest and the adoption rate at zero.

The third constraint is this skill's own posture. `components:`, `visual:`, `models:` and `plan-issues:` are all offered and never auto-written, and every one of them promises zero behaviour change when declined. A new block that behaved differently would be the odd one out in a skill whose whole value is predictability at bootstrap time.

## Decision

**`/init-agents` offers the `strategy:` block, and is design-doc aware: consume if present, ask if absent. It never scaffolds a document.**

### 1. The offer follows the established posture exactly

Offered in the interactive and `--refine` dialogs, never in `--auto`, never written autonomously. **Declining leaves the skill behaving exactly as it did before the block existed** — no block, no question, no extra body section, no label, no file. That is not a courtesy; it is the property that makes an optional block safe to add to a mandatory bootstrap, and it is the same promise `components:` / `visual:` / `models:` / `plan-issues:` each make.

### 2. Design docs are consumed, never produced

`design_docs.prd` / `.sdd` keep the three-state convention ADR 0008 §3 gave them, and the bootstrap acts differently in each state: a confirmed path is recorded and pointed at, with no questions asked; a declared `""` means the decision "this repo has no separate PRD" and triggers the Q&A below; an absent key means nobody has decided yet, which is what `--refine` re-asks.

That the middle and bottom states differ is the point of having three. `docs_command` established the distinction and the `/work-issue` Tester already reports on it: an absent field is a gap, a declared `""` is a decision. Collapsing them here would make `--refine` either nag a repo that has already answered or never ask a repo that has not.

**Detection proposes; the user confirms.** A path is written only after a human agrees the file genuinely is the PRD. An unconfirmed guess is worse than an empty string, because every stage of every loop would then load the wrong document as strategic context and nothing in the loop would notice.

### 3. The essence lands in the body, because the body is already read

When no document exists, four questions run once — purpose and non-goals, the leading decision, core components and their placement, the test bar — and their answers go into the **Markdown body of AGENTS.md**.

The body is the right container for exactly one reason: **every stage of every loop already loads it as context.** A file that is read on every run cannot rot unnoticed the way a document nobody opens can. A new `PRD.md` beside it would have no reader, no consumer, and no test — the three properties that make derived-versus-described documentation a real distinction rather than a stylistic one.

The four questions mirror the essential PRD/SDD sections without reproducing a template. Two of them had a home in the body template already (core components → the architecture section, test bar → the test-conventions section); two did not, so the template gains `## Purpose and Non-Goals` and a `### Leading Decision` sub-heading under the architecture section. Short answers are the intended output: two or three sentences. Anything longer is a document, and a document should be written as one and pointed at from `design_docs` instead.

### 4. Declaring `strategy:` creates no labels

This looks like an omission and is a decision. `plan-issues.goals` implies `goal:*` labels because it *is* a declared vocabulary — a closed, short, human-authored list. `feature_axis` has no vocabulary field, deliberately: `skills/plan-issues/SKILL.md` records that feature values are free text, many, project-specific and continuously created, and that the repo's existing `feature:*` labels are the working vocabulary. `/create-issue` creates each label on demand when a feature is first named.

So there is nothing to pre-seed, and inventing something to seed from would create a second vocabulary source for an axis whose contract explicitly refuses one. `gates:` implies no labels either — the booleans switch mechanisms that already exist and carry no taxonomy of their own.

### 5. Every pointer stays a pointer

The dialog restates none of what it configures. The block's shape and opt-in semantics stay canonical in this repo's `AGENTS.md`; the `feature:` label contract in `skills/plan-issues/SKILL.md`; what each gate injects in `skills/create-issue/SKILL.md`; the pre-flight report in `skills/work-issue/SKILL.md`. The commented block in `skills/init-agents/references/AGENTS.md.template` remains the one permitted copy artifact of the shape, named as such at both ends.

What *is* new writing, and therefore canonical in `skills/init-agents/SKILL.md`, is only this skill's own contract: the offer's dialog behaviour, the design-doc detection table, the four questions and the body sections they fill.

## Consequences

**For existing users:** nothing changes. A repo with an AGENTS.md is untouched until someone runs `--refine`, and the new step there is an offer with SKIP as a first-class answer. `--auto` is unchanged in every particular, including asking no strategic questions.

**For a new repo:** the strategic foundation exists from day one — as a pointer where documents exist, as four short body sections where they do not, and as nothing at all where the user declines. The bootstrap that was already mandatory now covers the decisions that were previously made implicitly by whoever committed first.

**For the template:** the body grows two English sections in an otherwise German scaffold. That is the deliberate consequence of the English-only hard gate applied honestly: existing German content stays until it is re-touched, and every new write is English. A one-pass translation of the whole body would be a larger change than the one being decided here, and it is not made under cover of this ADR.

**Accepted cost:** the interactive dialog gets longer for anyone who opts in — one offer plus up to four questions. The mitigation is that the offer is a single SKIP away, and that the questions run only on the path where no document answers them. A second cost is a mixed-language template body until it is translated deliberately.

## Migration

None required. A repo with no `strategy:` block keeps today's behaviour everywhere, and `/init-agents` produces the same AGENTS.md it always did when the offer is declined.

To adopt the block in an existing repo, run `/init-agents --refine --repo <slug>` and accept the offer. Point `design_docs.prd` / `.sdd` at real documents if they exist; otherwise answer the four questions and the essence lands in the body. To back out, remove the `strategy:` block — the body sections are ordinary Markdown and can stay or go independently.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). New backwards-compatible behaviour in one skill: no field becomes required, no existing field is reinterpreted, no default is flipped, and declining the offer reproduces today's output exactly. Not `patch` — in this plugin the Markdown is the runtime, and this adds a dialog step, a detection path and two template sections that did not previously exist. Not `major` — no caller breaks, and under 0.x there is no `major` bump in any case.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this is a behaviour change to a skill, not because the bump class demanded one — the same self-application ADR 0009 records.
