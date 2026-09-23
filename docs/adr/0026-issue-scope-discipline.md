# ADR 0026 — redirect loop findings instead of appending them: `found-in-loop`, a half-day cap, and a dated milestone

**Status:** accepted
**Date:** 2026-09-17
**Issue:** #71
**Amends:** `skills/create-issue/SKILL.md` (the `--from-loop` flag, the hard-suppressed step h), dialog question 12, the "Loop-finding redirect", "Effort estimate (half-days) and the four-half-day cap" and "Work-stretch end date (`due_on` anchoring)" sections), `skills/create-issue/references/issue-templates/code.md` and `.../research.md` (the `{{estimate_half_days}}` line, the `found-in-loop` label entry), `skills/plan-issues/SKILL.md` (the new "Label contract — `found-in-loop`" section), `skills/work-issue/SKILL.md` (a pointer sentence in "What this skill does NOT do"), root `CLAUDE.md` (the `/create-issue` row in "The 4 Skills").

> **Snapshot.** The cap number quoted below is the value as decided on this date. Its canonical home is `skills/create-issue/SKILL.md`, "Effort estimate (half-days) and the four-half-day cap"; if that number moves, this record stays as written — it documents the decision, not the current rule, and is therefore not a hard-gate-8 copy.

## Context

The Critic always finds something — that is its job. Without a rule against it, every piece of work in this loop is exactly as large as the Critic makes it, and two related incidents on a sibling project already showed the cost of a stretch of work with no fixed end: decision `0016` released the Docker socket on 17.08.2026 at 06:40 and `0020` took it back at 19:40 the same day — decision, build, insight and rollback inside one day — and that project's PRD went through five revisions in thirty minutes on 15.08.2026.

The initial framing of this issue assumed the leak was `/work-issue` filing an issue for a Critic or Tester finding. It is not: `/work-issue` states "Does not plan new issues itself" (`skills/work-issue/SKILL.md`, "What this skill does NOT do"), and the only issue-creating call anywhere in it is research-loop-only, optional, and confined to the Closer stage. In a code loop a finding stays a REVISE item under the existing 3-revise cap and nothing else is filed. This was confirmed twice by the Validator across two STOPs on this issue (2026-09-15 and 2026-09-17) before the spec below was built around the mechanism that actually exists.

The leak sits one step later: a human sees the REVISE item, runs `/create-issue` for it — cleanly, correctly — and `/create-issue` then offers, at step h), to drive the new issue through `/work-issue` immediately. Saying yes in that moment is cheap, and the run that just finished grows anyway. Redirecting scope became appending it, with one extra step in between to make it feel deliberate.

## Decision

### 1. `found-in-loop` is set by `/create-issue`, not by `/work-issue`

Because `/work-issue` never creates an issue in a code loop, the label recording "this issue exists because a loop run surfaced a finding" cannot be set there. `/create-issue` gains a flag, `--from-loop <issue>`, that marks exactly this case. When present, it sets the `found-in-loop` label on the new issue, records the originating issue number in the new issue's `## Standards Notes` block (`found-in-loop: originates from #<issue>`), and — the part that actually closes the leak — hard-suppresses step h) for that issue: the auto-handoff question is not printed at all, not defaulted to "No". A human who wants to drive the redirected issue through `/work-issue` still can, in a separate, deliberate invocation later; what is removed is the one-click path back into the run that just finished.

`found-in-loop` is a flag label with no configurable prefix and no value — unlike `area:`, `goal:` or `feature:`, nothing about it varies per repo, so nothing was added to `plan-issues.*`. Its full contract lives in `skills/plan-issues/SKILL.md`, alongside the repo's other label contracts, for the same reason those live there: it is where a backlog reader already looks for what a label means. `/plan-issues` itself applies no special-casing to the label — a `found-in-loop` issue is planned exactly like any other candidate, because a redirected finding is ordinary backlog work from the moment it is filed. Treating it as anything less would recreate the appending failure this label exists to prevent, one level up.

### 2. An estimate is required at creation, in half-days, capped at four

Dialog question 12 ("How many half-days is this?") is mandatory on every issue, regardless of type or flags. No answer refuses creation outright, before any preview. An answer above four half-days also refuses creation, shaped like the existing hard error for an unimplemented loop type (a printed `Error:` block that ends the run) rather than a soft warning or a fourth preview verdict — the same posture the "Supported types" check already uses for a comparable hard stop, so this is a shape the skill and its readers already know, not a new interaction pattern. An estimate of four or fewer half-days is rendered into the issue body so it can be read against the actual duration later, once there is enough data to make that comparison meaningful (evaluating that comparison as its own report is explicitly out of scope for this issue — not enough data points exist yet).

Half a day, not a full day, because the unit needs to distinguish "trivial" from "small" — a one-size bucket collapses exactly the distinction that makes a cap useful. Four half-days (two working days) as the ceiling, because it is small enough that a Critic's REVISE cycles still fit inside a single sitting, and because it matches this repo's own existing shape for "too big, split it" — the epic trigger in `skills/create-issue/SKILL.md` already fires on `>5` files-to-touch or `>800` words of spec, a comparable order of magnitude for "this needs to be more than one issue."

**No retroactive block.** The estimate question governs creation, not `/work-issue`'s pre-flight. An issue created before this change, or any issue whose body happens to carry no estimate line, is never blocked from reaching a terminal verdict on that account — `/work-issue`'s mandatory completeness pre-flight checks AGENTS.md fields, never an issue-body field this skill renders.

### 3. A stretch of work ends on a date, anchored to GitHub's own milestone field

"Done when it fits" has no end. The fix is not a new field — it is requiring that the milestone the dialog already asks for (question 11) actually carries a date. `due_on` is GitHub's native milestone field; a milestone chosen without one is refused at selection, with two named ways forward (pick a different milestone, or PATCH `due_on` on this one now) and no silent third option that creates the issue anyway. Declining a milestone altogether stays legal, but only for work that is not a stretch of work — a typo fix or a label correction has no beginning-and-end shape for a date to anchor to. The skill does not attempt to classify which case an issue is; declining the milestone question is itself the classification, the same posture the dialog already takes for `area:`/`feature:` (skipping is allowed, guessing is not).

## Consequences

- **Every future `/create-issue` run demands two answers it did not demand before**: an estimate, and (for a milestone'd issue) a dated milestone. This is deliberate friction — the whole point of the issue is that unbounded work is cheap to start and expensive to stop.
- **`found-in-loop` becomes a fourth stable, permanent issue-label axis**, alongside `area:`, `bundle:`, `goal:`/`waiting-on:` and `feature:`. It answers a question none of the others do ("did a human plan this from scratch, or did a loop's own review surface it") and, like the others, nothing branches on it except a human reading the backlog and `/create-issue`'s own suppression check.
- **The redirect is only as good as the humans who use `--from-loop`.** Nothing stops a human from filing a loop finding as a plain `/create-issue` run without the flag — that issue simply behaves as it always has, offer and all. This mechanism removes the one-click convenience that made appending the path of least resistance; it does not and cannot make appending impossible.
- **No AGENTS.md schema change.** The half-day cap, the `due_on` requirement and the `found-in-loop` grammar are none of them configurable per repo — they are fixed in `skills/create-issue/SKILL.md`, single-sourced there, same posture as the "Supported types" error text they are shaped after.

## Alternatives considered

- **`/work-issue` files the finding issue itself**, sets `found-in-loop`, and the handoff question is suppressed on that path instead. Rejected: it reverses a documented non-goal ("Does not plan new issues itself"), adds an issue-creating side effect to stages (Critic/Tester) that today only vote, and is a strictly larger change riding in on an issue whose corrected header — quoted and translated in the `## [loop]` escalation comment of 2026-09-15 — already located the leak "solely in `/create-issue`'s auto-handoff", one file away from `/work-issue`. Recorded as the rejected reading in that same comment; this ADR's decision 1 is the accepted reading from it.
- **A parallel `deadline:` field instead of anchoring to `due_on`.** Rejected: GitHub milestones already carry a due date; inventing a second date field the skill would have to keep in sync with the milestone one is exactly the kind of duplicate state this repo's single-source hard gate exists to prevent.
- **Defaulting step h) to "No" instead of hard-suppressing it for a redirected issue.** Rejected: a default-No question is still a question, and the issue's own analysis is that the moment of being asked is itself what makes appending feel cheap. Removing the question, not just its default answer, is what the corrected spec asks for.
- **A soft warning instead of a hard refusal for the half-day cap and the missing estimate.** Rejected: a warning that can be clicked past is exactly the mechanism that let scope grow unbounded in the incidents this issue cites. The `Error:`-block shape was chosen because the skill already has one precedent for "stop the run outright" (the unimplemented-loop-type error) and a second shape would need its own justification this issue does not have reason to give.

## What would reverse this

- If half-day estimates turn out to correlate weakly with actual duration once enough data exists, the unit or the cap number would be revisited — but not the requirement itself, since the gate's purpose (forcing an explicit size judgement at creation time) does not depend on the estimate being accurate, only on it being made.
- If `--from-loop` sees near-zero adoption in practice (humans keep filing redirected findings without the flag), that would argue for detecting the loop-finding pattern automatically rather than relying on an opt-in flag — a materially larger change than this issue's scope, and explicitly not attempted here.

## Version

**Minor**, per `version_policy` — new skill behaviour (the redirect mechanism, the estimate gate, the `due_on` requirement) plus a new flag (`--from-loop`), backwards-compatible for every existing AGENTS.md: no repo's AGENTS.md needs a single edit for `/create-issue` to keep working, because none of the three rules is a configurable field. The number itself lives only in `.claude-plugin/plugin.json`, per the single-source rule.
