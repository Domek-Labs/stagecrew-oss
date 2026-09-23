# ADR 0017 — an optional per-stage `effort:` axis, shipped declarative because the dispatch cannot carry it

**Status:** accepted
**Date:** 2026-09-03
**Issue:** #116 (landed together with #117 / `docs/adr/0018-implementer-model-default.md`)

## Context

`work-issue.models.<stage>` lets a repo pick which model each loop stage runs on. On the current model generation that is half of the control surface: the other half is **reasoning effort**, and stagecrew had it nowhere. Measured on `dev` @ `152f100`, `grep -rniE 'effort|xhigh' skills/` returned exactly **one** hit, in `research-implementer.md:48`, and it meant "estimate the work per test-matrix cell" — not the parameter.

Effort applies to every output token, so it governs how many tool calls a stage makes and how much preamble it writes — precisely the behaviours a five-stage loop pays for on every iteration. Without the axis, a repo that wants the loop cheaper has exactly one instrument: a weaker model on a gate. That is the trade the repo has been arguing it should stop offering. An effort axis is the cost lever that does not weaken a gate.

The API location is `output_config: { effort: "<level>" }` — **inside `output_config`, not top-level**. Naming it matters because the wrong guess is a silent no-op rather than an error.

## Decision

**Introduce an optional `effort:` block inside the `work-issue:` namespace, as a second axis on the existing model-resolution mechanism — and ship it declarative, saying so plainly, because the subagent dispatch cannot carry the parameter.**

Six parts:

1. **Same shape, same six stage keys** (`validator`, `implementer`, `tester`, `visual`, `critic`, `closer`). Legal levels `low | medium | high | xhigh | max`. Absent block = zero behaviour change.
2. **Same three resolution tiers as `models:`** — `work-issue.effort.<stage>` (L1 base) → `loop_types.type_overrides.<type>.effort.<stage>` (L1 type layer, right-wins) → an `effort.<stage>` key nested under `work-issue:` in the issue's `## Standards Override` block (L2) → unset. A top-level `effort:` in the override block is ignored with a note.
3. **Same prefer-and-degrade posture.** An unknown level, or a model that does not accept it, falls back to the default, is noted in the stage comment, and the loop continues. Never a STOP, and never part of the mandatory field-completeness pre-flight. The two axes fall back independently.
4. **Extend the existing section, do not add a sibling.** `### Model resolution (per stage)` became `### Model and effort resolution (per stage)`, and `### Per-stage model dispatch` became `### Per-stage model and effort dispatch`; all four cross-references were updated in the same edit. A parallel mechanism would have been a hard-gate-8 violation and would have doubled the resolution rules to keep in step.
5. **One audit line, prescribed exactly**, so that no stage invents a format:
   ```
   model: <alias|inherited|inherited (<alias> requested, unavailable)>, effort: <level|default|default (<level> requested, unavailable)>
   ```
   One line, `model` first, comma-space separator, `effort` always present. An unset effort renders `default`, never `inherited` — `inherited` is the model vocabulary and reusing it would blur two different fallbacks. Grammar canonical in `skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch".
6. **The recommendation lives only in `skills/init-agents/references/model-presets.md`**, gains an effort column and four preset effort blocks, and is labelled unmeasured. `AGENTS.md.template` carries the commented `effort:` values as the fifth permitted copy artifact under hard gate 8, updated in the same PR.

### The part that reshapes the feature: the dispatch cannot apply effort

The subagent dispatch this plugin uses exposes `description`, `isolation`, `model`, `prompt` and `subagent_type` — and **no effort parameter**. Per-agent reasoning effort comes from an agent *definition*; every stagecrew stage dispatches a general-purpose agent with an inline briefing. `models:` works only because the resolved alias is handed straight to `model:`. A resolved effort level has nowhere to go.

So the axis is **declarative in the current harness**: parsed, cached, resolved, carried into the briefing and written onto the audit line as the level that was *requested* — and it does not change how a stage runs.

Two consequences are binding:

- **A stage records the effort it requested, never "the effort that ran."** The loop cannot observe what ran. Emitting `effort: xhigh` when nothing carried that level to the model is a fabricated audit line — the same defect class as a Closer reporting a merge SHA it never read (`docs/adr/0003-model-selection.md`, battle-test observation 2).
- **A repo that sets `effort:` today buys an intent record, not a behaviour change**, and every place that offers the block says so.

**What would make it effective, stated as a condition rather than a hope:** the dispatch gaining an effort parameter. When it does, the dispatch step passes the resolved level through alongside `model:`, the wording changes from "requested" to "ran", and *nothing else moves* — not the resolution order, not the cache, not the audit-line grammar. That is the whole reason the axis ships on the `models:` rails.

## Alternatives considered, and why each was rejected

**Per-stage agent definitions**, one per stage, each carrying its own effort in frontmatter. This would make effort effective today. Rejected: it replaces one mechanism with two — a stage would resolve its model from AGENTS.md and its effort from a plugin-internal agent definition, which puts an effort value *inside the skills*, where this repo's pure-reader rule says no model alias and no effort level may live. It also breaks the axis's own resolution order: an agent definition cannot be overridden per issue from a `## Standards Override` block.

**Ship nothing until the dispatch supports it.** Rejected, but it was the closest call. Against it: the resolution order, the AGENTS.md schema, the audit line and the recommendation table are the bulk of the work and are all independently useful — a repo can record its intent, and the day the parameter appears the change is one line in one step. For it: shipping a resolving-but-inert axis is exactly the "documentation of an unimplemented feature" this repo has faulted before. That objection is answered by *saying so*, in the canonical place, once — which is what the decision above does. An inert feature that announces its inertness is a different object from one that pretends.

**Auto-tuning effort from issue size or diff size.** Rejected and named out of scope in the issue: the axis is declarative like `models:`. Inference would make the audit line unpredictable and would put a heuristic where a repo's stated preference belongs.

**A `model: opus, effort: xhigh` line that reports the level as what ran.** Rejected as fabrication; see above.

## Consequences

- A repo with no `effort:` block behaves exactly as before — the same guarantee `models:` already gives.
- Nine emission sites now carry the two-part audit line: six inline stage briefings in `skills/work-issue/SKILL.md` and three subagent briefs. The count matters because this feature has failed at exactly this seam before (`docs/adr/0003-model-selection.md`, battle-test observation 1: three brief files updated, four inline templates missed, and the Tester passed because the line existed *somewhere* in the diff). A `grep 'End the comment with'` finds only five of the six inline sites; the search that finds all of them is `grep -rn 'model: <model>' skills/` plus `grep -rn 'model: {{model}}' skills/`.
- The recommended effort levels are **unmeasured**. They are derived from published per-model guidance, not from a measurement in this repo, and are labelled as such in the canonical file. Replacing them with evidence is the eval work tracked in #81.
- The `code` vs `research` implementer split needs no effort override: both rows carry the same recommended level, so `loop_types.type_overrides.research` keeps its `models:` block and deliberately gains no `effort:` block. The template says so rather than leaving it silently absent.
- The cache caveat is stated once, in the canonical file, and no more absolutely than it holds: changing top-level effort between requests does invalidate the prompt cache, which is irrelevant here because each stage is its own dispatch — and a per-message mechanism exists that avoids the reset entirely, so the restriction is not a general law about effort.

## Follow-ups (out of scope for this ADR)

- Making the axis effective — one line in the dispatch step, once the parameter exists.
- Measuring the recommended levels (#81). Until then the column is a starting point, not a result.
- Effort for non-loop skills (`/create-issue`, `/plan-issues`, `/close-out`).
