# Model Presets — Canonical Source

**Read by `/init-agents` only** — specifically when writing or updating a repo's `models:` and
`effort:` blocks (interactive preset picker and `--preset <name>` non-interactive path).

**`/work-issue` does NOT read this file.** At loop time the only source for model aliases and
effort levels is the target repo's `AGENTS.md`. This file is the authoring-time source of truth:
the knowledge from which a repo's `models:` and `effort:` blocks are generated. Moving it into a
target repo's AGENTS.md would break the bootstrap — `/init-agents --models` must know the
`balanced` preset values *before* the target repo has any block to read.

---

## Recommended per-stage mapping

| Stage | Model | Effort | Why |
|-------|-------|--------|-----|
| `validator` | `sonnet` | `medium` | Judgment call (spec vs. repo reality); the cheapest tier is too thin for a gate, the top tier is waste. The judgment is narrowly scoped — one issue against one repo — so it does not need the top effort level either |
| `implementer` (code) | `opus` | `xhigh` | The build and the Critic verify the output afterwards, but the stage still writes the diff: multi-file changes, larger refactors, work that has to hold together end to end. Anthropic positions the Opus tier as the starting point for coding and agentic workloads and `xhigh` as the level for demanding coding and agentic work; both are vendor positioning, not a measurement made in this repo |
| `implementer` (research) | `opus` | `xhigh` | Evidence-critical — a weaker model restates unverified numbers as fact |
| `tester` | `sonnet` | `medium` | Must distinguish "present" from "effective" — verifying that a rule holds against reality is a judgment call wearing a mechanical costume, not a command-runner. Judgment, but not the gate: the cheapest tier produced a false PASS on a materially unmet AC; the top tier belongs to the Critic and is waste on a stage that reports findings rather than adjudicating them |
| `visual` | `sonnet` | `medium` | Vision + judgment against the Visual Acceptance ACs |
| `critic` | `opus` | `high` | This is the gate; a weak Critic is worse than no Critic because it produces a false APPROVE with an audit trail. `high` is documented as often the sweet spot between quality and token efficiency — that is the claim being relied on, not a claim that review accuracy is unaffected below `xhigh` |
| `closer` | `sonnet` | `low` | Must report resulting state accurately (merge SHA, issue state, branch deletion) — executing the commands is routine; reporting what they produced is not. The cheapest tier misreported a merge SHA into the audit log; the stage adjudicates nothing, so it does not need the gate tier, and it runs a fixed command sequence, so it does not need the effort |

This is the `balanced` preset. It ships **commented out** in
`skills/init-agents/references/AGENTS.md.template` — the template must carry the literal values
because a copy artifact cannot contain a pointer in place of the thing being copied.
**That is a deliberate duplication** — one of the copy artifacts hard-gate 8 permits; see `AGENTS.md`
hard gate 8 for the full list. The two files must be updated together
whenever the recommendation changes. When that happens, update all four:
1. The mapping table above (this file)
2. The preset tables below (this file)
3. The commented-out `models:` block in `AGENTS.md.template`
4. The commented-out `effort:` block in `AGENTS.md.template`

### The alias order is a capability order, not a price order

Reading the alias list as a cost ladder is the mistake this table used to make. On the published
positioning for the current generation, `fable` is the **most expensive and the slowest** alias in
the lineup, not the cheap throughput one; `opus` is the documented entry point for coding and
agentic workloads; `sonnet` is the fast everyday tier. Reach for `fable` where `opus` at a high
effort level does not finish the job — that is a deliberate escalation, which is why it appears
only in the `quality` preset. Rationale and the limits of the evidence:
`docs/adr/0018-implementer-model-default.md`.

### The effort levels here are unmeasured starting points

The legal levels are `low | medium | high | xhigh | max`; absent = the API/session default.

**Every effort value in this file is derived from Anthropic's published per-model guidance, not
from a measurement in this repo.** There is no eval for stage quality here yet, and the same
documentation that supplies these levels is emphatic that a default should be raised only after
measuring on a sample of real requests, tuned per route rather than globally. Treat the column as
a starting point to measure, not a result to trust.

### Effort is declarative today

`effort:` is parsed, resolved, cached and recorded — and, in the current harness, **not applied**:
the subagent dispatch carries a model parameter and no effort parameter. The canonical statement of
that gap, and of what would change when the dispatch gains the parameter, is in
`skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch". It is why a stage comment
records the effort *requested*, never "what ran". Recorded in
`docs/adr/0017-per-stage-effort-axis.md`.

### Caching: pick effort per stage, never within one

Changing the top-level effort setting between requests invalidates the prompt cache. That is not a
problem for this axis, because each stage is its own dispatch and picks its level once. It *would*
be a problem for varying effort inside a stage, which is why this file recommends nothing of the
kind. (A per-message mechanism exists that changes effort mid-conversation without resetting the
cache, so the restriction is not absolute — it is simply not a route stagecrew has any reason to
take.) Effort is also not the first lever to reach for: prompt caching comes before it, being a
saving that trades nothing.

---

## `code` vs `research` implementer split

The existing `loop_types.type_overrides.<type>` block accepts `models:` and `effort:` as valid
keys. This is the idiomatic way to set a stronger Implementer for research loops without touching
the base blocks:

```yaml
loop_types:
  type_overrides:
    research:
      models:
        implementer: opus   # evidence-critical, unlike a code diff
        critic:      opus   # keep the gate strong for research findings
```

A code diff is verified by a build (Tester) and a diff review (Critic). A research findings doc
must cite verifiable evidence; a weaker model restates unverified numbers as fact, and the Critic
cannot always catch fabricated citations. The recommended effort for both implementer rows is the
same (`xhigh`), so the type override needs no `effort:` key unless a repo wants to differ from the
base block.

---

## Preset definitions

| Preset | `validator` | `implementer` | `tester` | `visual` | `critic` | `closer` | Trade |
|--------|-------------|---------------|----------|----------|----------|----------|-------|
| `balanced` | `sonnet` | `opus` | `sonnet` | `sonnet` | `opus` | `sonnet` | Recommended default — strong gates on the two judgment stages, the coding tier on the stage that writes the diff, the fast tier on reporting stages |
| `economy` | `sonnet` | `sonnet` | `sonnet` | `sonnet` | `opus` | `sonnet` | Saves on the Implementer — the stage that structurally carries the most volume (reasoning from what the stage does, not a measurement: `docs/adr/0018-implementer-model-default.md`) — and **keeps the Critic gate at `opus`** — the cost lever no longer runs through the gate. A verification trade-off, not a gate-quality one |
| `quality` | `opus` | `fable` | `sonnet` | `opus` | `opus` | `sonnet` | The deliberate escalation: `fable` on the Implementer for a long-horizon or ambiguous issue, at the highest price per token and the slowest responses of any alias. Top tier on every judgment and gate stage; highest token cost |
| `inherit` | _(removes the `models:` and `effort:` blocks entirely — clean opt-out)_ | | | | | | Every stage inherits the session model and the default effort; zero behavior change vs. no block |

## Preset effort blocks

| Preset | `validator` | `implementer` | `tester` | `visual` | `critic` | `closer` | Trade |
|--------|-------------|---------------|----------|----------|----------|----------|-------|
| `balanced` | `medium` | `xhigh` | `medium` | `medium` | `high` | `low` | Mirrors the mapping table above |
| `economy` | `low` | `high` | `low` | `low` | `high` | `low` | One level down on every stage that is not a gate; the Critic keeps `high` |
| `quality` | `high` | `xhigh` | `medium` | `high` | `xhigh` | `low` | Effort raised wherever a stage judges; the Closer still adjudicates nothing |
| `inherit` | _(writes no `effort:` key)_ | | | | | | Every stage runs at the API/session default |

`balanced` is the recommended default and mirrors the mapping table above.
`inherit` writes neither a `models:` nor an `effort:` key at all — parsing the frontmatter
afterwards yields neither, restoring session-inherit behavior on both axes.

A preset always sets both axes. A repo is free to write only one of the two blocks by hand; a
partial block on either axis is legal and overrides only the stages it names.
