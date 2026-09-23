# ADR 0019 — stage-report length is calibrated by shape, not by a number; the research doc's word floor and its Tester gate are removed

**Status:** accepted
**Date:** 2026-09-03
**Issue:** #119

> **Snapshot.** The rule quoted under Decision 2 is the wording as decided on this date.
> Its canonical home is `skills/work-issue/SKILL.md`, "Issue-comment convention"; if the
> wording there moves on, this record stays as written — it documents the decision, not
> the current text, and is therefore not a hard-gate-8 copy.

## Context

Every stage of `/work-issue` carried a numeric output ceiling, and the research
deliverable carried a numeric **floor** that a Tester checkbox enforced. Measured on
`dev` @ `10e5c73` with `grep -rPin 'max(imum)?[^0-9\n]{0,12}[0-9]+\s*words'`, there
were **nine** cap sites — the Validator, both Tester briefings, the Critic and the
Closer in `skills/work-issue/SKILL.md`, the parent-output header of the code, research
and visual briefs, and the findings document's own executive-summary section — and
**four** floor sites: the Researcher's `at least 800 words (typically 1500-3000)`, the
`Word count >= 800 (wc -w)` item in both copies of the research check list, and the
`(>=800 words)` clause in the `research` issue template's acceptance criteria.

Two defects, and they are not the same defect.

**The ceilings are a dated pattern.** Each number was tuned against an earlier
generation's verbosity. A ceiling says nothing about what a report must contain, and it
invites the one failure the loop cannot afford: a stage truncating a genuine finding to
stay under a number. Where a required-field list already stood beside the number, the
field list was doing all the work. Where none stood — four of the nine sites — the
number was the *only* guidance present, so deleting it alone would have left
`> Parent output.`, an instruction with no content.

**The floor is worse, because it was checked.** A minimum word count is an
anti-under-delivery quota from an era when models under-delivered on written work. It is
also a **proxy**: the same check list already asserts, directly, everything the count was
standing in for — a doc exists, a test-matrix table is present, at least six probes are
documented, a working setup or a hypothesis roadmap is there, a follow-up issue spec is
attached, sources are linked, no secrets leaked. A findings doc that satisfies every one
of those and comes in at 700 words was a FAIL. That is the gate failing, not the doc.
And on the current generation the quota rewards precisely the padding the rest of the
guidance tells the Researcher to suppress.

**A note on what this decision does *not* rest on.** An argument was available from the
current model guidance that reasoning effort governs thinking volume rather than visible
output length, so length has to be prompted explicitly. It is not used here, for two
reasons: `docs/adr/0017-per-stage-effort-axis.md` states the opposite emphasis in this
repo's own words ("Effort applies to every output token … how much preamble it writes"),
and — decisively — **effort is declarative in this repo today**: the subagent dispatch
carries a model parameter and no effort parameter, so no effort level reaches any stage.
The effort/length relationship is inert as a control here. The decision stands on the two
grounds above: the dated-pattern ground and the proxy ground.

## Decision

**1. No skill carries a numeric word cap.** All nine sites lose the number. The eight
that are stage reports keep (or gain) a required-field list and point, for length, at the
single canonical rule. The ninth — the findings document's executive summary — is a
section of a deliverable rather than a report to the parent, so it takes a shape written
for its own artifact: the TL;DR a reviewer reads first, carrying the research question,
the answer, and whether a working setup was found.

**2. The length rule is stated exactly once**, in `skills/work-issue/SKILL.md` under
"Issue-comment convention", whose scope is widened there to cover both surfaces a stage
produces — the issue comment it posts *and* the parent report it returns. The rule:
match the length to what the next stage and a later reader need, lead with the outcome,
cover the required fields, do not pad with filler sections, redundant summaries or
boilerplate, and do not truncate a genuine finding to reach a size. Every other site is a
field list plus a pointer, never a paraphrase — hard gate 8.

**3. The 800-word floor is removed at all four sites**, including the acceptance-criterion
template, which would otherwise keep propagating the gate into every research issue from
the producer side. The Researcher brief gets the anti-padding instruction in its place:
length follows the content, every required section covered, no padding to reach a length.
**No replacement number of any kind** — no character budget, no token budget, no
"typically N"; the `(typically 1500-3000)` hint went with the floor rather than surviving
it as the last unenforced number in the file.

**4. The `at least 6 probes` floor stays, and it stays for a reason that does not
generalise to word counts.** It is **methodological coverage — do not conclude from one
data point — not an output-style quota**. It bounds how much of the problem was actually
examined, not how much prose was produced about it. A later audit removing it by analogy
with this decision would be removing a different kind of thing; this paragraph exists so
that audit stops here.

**5. A numeric length bar, where a repo wants one, belongs in that repo's AGENTS.md.**
The standing rule in this repo's AGENTS.md is that no model alias and no effort level is
a default anywhere in the skills — both are read from the target repo's AGENTS.md or from
nowhere. By mechanism a word count is not one of those: it has no declared field, no
resolution order, no fallback. By **intent** it is exactly one of those: a
generation-sensitive tuning constant hardcoded inside a skill, which goes stale there and
which the repo that suffers it cannot correct. `max 150 words` is no different in kind
from hardcoding `sonnet`. The consequence, stated so it cannot be over-read: this is a
reason the skills must carry **no** number — it is **not** a licence to add a `word_cap:`
field. No new AGENTS.md field is introduced by this decision, and none should be. A repo
that wants a length bar states it in its own AGENTS.md (a `hard_gates` entry or a body
sentence), where it owns it and can fix it, and no skill supplies a default.

## What replaces the removed gate

The remaining content checks, and they are the stronger assertion — this is the part a
future reader is most likely to challenge, so it is stated plainly.

- **The removed check was never mechanical.** Nothing in `checks/` implemented it. It was
  a checkbox in a subagent prompt, evaluated by a model, exactly like the seven beside it.
  `node checks/run.js` runs five structural checks and none of them concerns word counts.
  So no automation was lost — a proxy assertion was.
- **Two surviving checks discharge the floor's real function far more directly than a
  total ever could:** `at least 6 probes` is the actual depth floor, and `sources list with
  at least 1 link` is the actual evidence floor. The required-section list makes a hollow
  doc fail on structure. A word count can be satisfied by prose containing none of them.
- **A removed verification gate is a contract change**, which is why this ADR exists on
  that trigger as well as on the "documented behaviour changed" trigger: every stage's
  output contract changes with decision 1.

## Alternatives considered, and why each was rejected

**Lower the numbers instead of removing them.** Rejected: it re-tunes a constant against
today's generation and schedules the same defect for the next one. The number is the
defect, not its value.

**Keep the caps at the four sites that carry a field list, remove them at the four that
do not.** Rejected: it leaves the loop half-governed by an instrument this ADR argues is
the wrong one, and it makes the rule unstateable in one place — the outcome hard gate 8
exists to prevent.

**Replace the floor with a lower floor (say 400 words), or with a character or token
budget.** Rejected on the same ground as the first alternative, and explicitly out of
scope for #119: a new length instrument is a new thing to go stale.

**Add a `word_cap:` AGENTS.md field so the repo can set the number.** Rejected: it is new
machinery for a value this decision argues should not exist as a number in the loop's
plumbing at all, and it hands every repo a knob that goes stale in its turn. See decision 5.

**Harmonise the two copies of the research check list while editing them.** Rejected as
out of scope: the copies already diverge (the `skills/work-issue/SKILL.md` copy is missing
the `Doc exists` item that the brief's copy carries, and the issue template's AC list is a
third, materially different set). That divergence is #51's work. This change removes the
word-count item from every copy that had it and touches no other item in any of them, so
it neither closes nor widens the divergence.

## Consequences

- **Every stage's parent report changes shape**, and four of them gain guidance where they
  previously had only a number. No stage loses a required field: the `Doc path + word
  count` field in the Researcher's stage comment stays, because a reported count is a
  fact, not a threshold — it must simply never be paired with a bar.
- **A 700-word findings doc that satisfies every content check now PASSes**, and a doc
  missing a required section still FAILs. That is the whole intended behaviour change.
- **`/create-issue --type=research` stops writing a word floor into acceptance criteria**,
  so issues created before this change carry an AC the Tester will no longer check. Those
  ACs are satisfied on their content clause; the parenthetical is dead text.
- **No AGENTS.md field is added, removed or re-interpreted**, so no existing repo's
  configuration breaks. Bump class `minor` under `version_policy`: changed skill behaviour
  that stays backwards-compatible for existing AGENTS.md files.
- The epic trigger in `skills/create-issue/SKILL.md` — `spec block >800 words` → "sub-issue
  split recommended" — is **untouched and out of scope**. It is a different skill, a
  different artifact (the issue's own spec block, not a deliverable) and a different
  consequence (a preview warning, not a verdict). It is named here so a future sweep for
  "the 800" does not collect it.
