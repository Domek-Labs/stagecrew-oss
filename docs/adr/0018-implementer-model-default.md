# ADR 0018 — the recommended Implementer model moves from `fable` to `opus`; `fable` becomes a deliberate escalation

**Status:** accepted — supersedes the Implementer row of the mapping recorded in `docs/adr/0003-model-selection.md`
**Date:** 2026-09-03
**Issue:** #117 (landed together with #116 / `docs/adr/0017-per-stage-effort-axis.md`)

## Context

`skills/init-agents/references/model-presets.md` put `fable` on the Implementer and called it the throughput stage:

> `| implementer (code) | fable | Throughput stage; the build and the Critic verify the output afterwards |`

The rationale argued cheap-and-verify — spend little here, the Tester and the Critic will catch it — and then named the **most expensive and slowest** alias in the lineup. On the published positioning for the current generation:

| Alias | Input / output per MTok | Comparative latency | Positioned for |
|---|---|---|---|
| `fable` | $10 / $50 | Slower | demanding reasoning and long-horizon agentic work |
| `opus` | $5 / $25 | Moderate | complex agentic coding and enterprise work |
| `sonnet` | $2 / $10 | Fast | everyday coding, agentic tool use |

And the documented entry point is not `fable`: the guidance is to start with the Opus tier for most workloads and reach for Fable when evals on Opus *at higher effort* still fall short.

So the table was inverted on both axes it implicitly claimed. That is the checkable defect, and it is the whole of the claim being made here: **the stated rationale contradicted the chosen tier on cost and on latency.**

The knock-on was in `economy`, whose Trade text read:

> "Trades away the Critic gate (drops `opus` → `sonnet`) — that is the only cost lever remaining once every verification stage is at `sonnet`"

That was only true because the Implementer's tier had never been questioned. With the Implementer on the top tier, the *largest* cost lever sat untouched and the preset reached for the gate instead.

**A correction to the issue text, made during implementation.** #117 §3 described the `economy` change as Implementer `opus` → `sonnet`. Measured on `dev` @ `152f100`, `model-presets.md:63` read **`fable`**, not `opus` — both `balanced` and `economy` carried `fable` on the Implementer. The change made is therefore `fable` → `sonnet` for `economy`. The intent of §3 is unaffected: the cost lever moves to the stage with the most room and stops running through the gate.

## Decision

**Move the recommended Implementer tier from `fable` to `opus`; make `fable` a deliberate escalation rather than a default.**

| Row | Before | After |
|---|---|---|
| recommendation table, `implementer` (code) | `fable` | `opus` |
| `balanced` preset, `implementer` | `fable` | `opus` |
| `economy` preset, `implementer` | `fable` | `sonnet` |
| `economy` preset, `critic` | `sonnet` | `opus` |
| `quality` preset, `implementer` | `opus` | `fable` |

Four supporting parts:

1. **The `implementer` rationale no longer calls the top tier a throughput stage.** The true half is kept — the build and the diff review verify the output afterwards — and the stage is described for what it does: it writes the diff.
2. **`economy` stops trading the gate.** The Critic returns to `opus` and the saving comes from the Implementer, the stage that structurally carries the most volume — reasoning, not a measurement, as the Consequences section below states. `economy` is now a verification trade-off, not a gate-quality one.
3. **`quality` is where `fable` belongs** — chosen for a long-horizon or ambiguous issue, with the price and the latency named in its `Trade` column.
4. **The ordering is stated once**, in the canonical file: the aliases are a **capability order, not a price order**. `fable` is the most expensive and the slowest; `opus` is the documented starting point for coding and agentic loops; reach for `fable` where `opus` at a high effort level does not finish the job.

`skills/init-agents/references/AGENTS.md.template` carries the same values in its commented `models:` block — the copy artifact hard gate 8 permits — and changed in the same PR, as the canonical file itself instructs.

### What the effort axis does and does not contribute here

The guidance this decision rests on says to reach for the most capable model *at a lower effort* before swapping tiers, which is why #116 and #117 were validated and landed as one change. But the effort half of that argument is **not available yet**: the dispatch carries no effort parameter, so the `effort:` axis is declarative (`docs/adr/0017-per-stage-effort-axis.md`). The recommended `balanced` Implementer row is therefore **`opus`**, and the `xhigh` beside it in the effort column is a recorded intention, not a compensating lever.

**Said plainly: the tier change stands on its own.** It is not "a smaller model plus more effort" — it is a correction to a row whose stated reasoning contradicted its own value. If it were resting on the effort lever, it would not be shippable today.

## Alternatives considered, and why each was rejected

**Leave the values, fix only the prose.** Rejected: the prose was the symptom. A row that says "the Opus tier, because the loop's heaviest stage is what that tier is positioned for" and then writes `fable` is a worse artifact than either half alone.

**Move the Implementer to `sonnet` in `balanced` too.** Rejected: it makes an unmeasured quality claim in the expensive direction. The defensible move is to the documented starting point, not past it.

**Wait for #81's evals before touching any tier.** Rejected: the defect being fixed is not "the wrong tier wins on quality" — that would need evidence this repo does not have. It is that the recommendation's *own stated reason* was false. Correcting a self-contradiction does not need an eval; changing the recommendation on quality grounds would, and this ADR does not do that.

**Remove `economy` entirely (#30).** Out of scope here and coordinated, not fought: if #30 lands, the `economy` row disappears with it. This decision changes the premise #30 argues against — with the Implementer off the top tier, `economy` and `balanced` are two cells apart rather than one.

## Consequences and the limit of the evidence

- **No existing repo's loop-time behaviour changes.** `/work-issue` never reads `model-presets.md`; a repo with an explicit `models:` block is untouched. Only newly authored or re-preset blocks differ. The flip is a default change with the old behaviour available as a one-word opt-in (`implementer: fable`), which is precisely the migration path `version_policy.minor` requires.
- **This ADR does not claim `opus` produces better diffs than `fable`.** No controlled comparison exists in this repo — the same limit `docs/adr/0003-model-selection.md` records in its "Limits of this evidence" section, and it applies here word for word. The claim is narrower and checkable: the stated rationale contradicted the chosen tier on cost and latency, and a default should not be the priciest option on the loop's heaviest stage without evidence for it.
- **"The Implementer is the loop's largest token consumer"** is a structural argument — it reads context, writes the diff, and re-runs on every REVISE — not a measurement. It is reasoning here, and it is deliberately not asserted as fact in the canonical file.
- **`docs/adr/0003-model-selection.md` is superseded by note, not rewritten.** Its snapshot fence already declares the quoted mapping historical, and its Evidence section is field notes from a real run. Rewriting either would falsify the audit trail.
- `haiku` remains a legal alias, unused by every preset — unchanged by this decision.
