# ADR 0009 — the four strategic gates become effective, without growing a mechanism of their own

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #92 (depends on #90)
**Amends:** ADR 0008 — the `gates:` booleans it introduced as declared intent now act, in `/create-issue`, `/work-issue` and `/plan-issues`. Supersedes nothing.

## Context

ADR 0008 gave the four strategic decisions one opt-in home: `architecture_adr`, `component_reuse`, `test_evidence`, `documentation`. It deliberately shipped them as booleans that nothing read yet. A boolean nobody reads is a comment, and a comment in a schema is a trap — it looks like configuration and behaves like prose.

Making them act raises one question per gate and one question overall. Per gate: *what does it switch on, and how would we know it cannot deliver?* Overall: *how do four gates become effective without four new mechanisms* — the exact duplication ADR 0008 refused, and the thing hard-gate 8 exists to prevent.

Three of the gates already have an owner. `component_reuse` has the Component Reuse Check in `skills/create-issue/SKILL.md`, which owns its trigger, its AC text and its enforcement level. `test_evidence` has `smoke_test` and `ac_templates`. `documentation` has `docs_command`. The fourth, `architecture_adr`, has none: the ADR practice is a habit this repo follows, written down nowhere as an injection contract. The only ADR *rules* that exist are one line inside the Component Reuse Check's AC block and the `version_policy` rule in AGENTS.md, which is about version semantics, not architecture.

## Decision

**Each gate switches on the mechanism that already owns it, and points at it. No gate re-implements, re-words or re-triggers anything.** The three consumers are the three places a decision is actually made:

- `/create-issue` injects the enabled gates' ACs, in the same position and shape as the Component Reuse Check.
- `/work-issue`'s pre-flight reports a gate whose mechanism is unconfigured.
- `/plan-issues` prints the gate state in the plan output.

### 1. `architecture_adr` gets exactly one canonical home, and it is `create-issue`

The one gate without an owner would otherwise grow one by accident, in whichever file described it last. Its AC text and its trigger live in **`skills/create-issue/SKILL.md`, section "Strategic Gates"**, beside the Component Reuse Check — because what the gate produces *is* an AC injection, the same artifact of the same shape, and an injection contract belongs where injections are defined. AGENTS.md, CLAUDE.md and the template point there and restate none of it.

The `version_policy` ADR rule stays canonical in AGENTS.md and is **not** repeated. The two are independent by construction: this gate asks for an ADR because the architecture changed, `version_policy` asks for one because the version semantics demand it. An issue can trip either, both, or neither.

### 2. "The docs AC template" is a lookup, not an artifact

ADR 0008 wrote "`documentation` → `docs_command` + the docs `ac_template`". No such template exists — not in this plugin, not in the schema. Inventing one would have created a fifth mechanism to enforce a gate that was supposed to enforce none, and put a recommendation in a file that does not own it.

It is therefore defined as a **lookup into the repo's own `ac_templates`**: the first entry whose text concerns documentation. **No match is a legal state** — it means the repo has no documentation AC, which is precisely what the pre-flight report is for. The plugin never supplies the missing entry.

### 3. A gate can only add; it is never a precondition

`component_reuse: true` does **not** become a condition for the Component Reuse Check. That check fires on a `components:` block plus a scope signal, exactly as before, and a repo with `components:` and no `strategy:` block behaves identically to how it did — ADR 0008's zero-behaviour-change promise, held in the direction it is easiest to break. The gate adds only the pre-flight report when `components:` is missing, and the gate's state in the plan.

Stated generally, because the trap is general: **switching a gate on can only add behaviour; it can never withhold behaviour a repo already has.** `false` behaves exactly like an undeclared gate, so there is no third state to reason about.

The rule is about **mechanism preconditions, not about strength**. A gate may make an AC it injects non-dismissible — `test_evidence` does exactly that, and that is the gate doing its stated job of moving an existing mechanism from optional to strategically-required, on the Component Reuse Check's own precedent. What a gate may never do is make the mechanism itself conditional on the gate.

### 4. "Unconfigured" is defined per gate, or the gate is never reported

A report needs a testable condition, and a naive one would fire on every run. `smoke_test` and `ac_templates` are mandatory fields, so `test_evidence` can never be *missing* anything — but both may legally be **declared no-ops** (`""` and `[]`), and only that combination is reported. Either one being real means configured. The consequence is deliberate and was the point of defining the rule: this gate is silent in almost every repo, including this one, whose five `ac_templates` carry its test evidence.

The per-gate table — fields read, what "unconfigured" means, the exact report line — is canonical in **`skills/work-issue/SKILL.md`**, beside the pre-flight that runs it, and nowhere else. `documentation` reuses the three-state distinction the Tester already applies to `docs_command` (real command / declared `""` / absent field) and names which of the two empty states it found.

### 5. The report is never a STOP

A gate whose mechanism is missing is a promise the repo cannot keep — worth saying, worth nothing to block on. Refusing to run would make incremental adoption impossible: a repo could never switch on the first gate before configuring all four. An empty report is not printed at all; a pre-flight that announces its own silence trains the reader to skip it.

### 6. `plan-issues` prints state, not judgement

The plan shows `on` / `off` per declared gate and stops there. It does not evaluate whether a mechanism is configured — that rule lives in the pre-flight of the run that acts on it, and copying it into a second file would let the two drift. With no `strategy.gates`, the output is exactly what it is without it, mirroring the feature-axis rule one block above it.

## Consequences

**For existing users:** nothing changes without a `strategy:` block, and nothing changes for a repo whose gates are all `false` or absent. A repo with `components:` and no `strategy:` block is explicitly unaffected — §3, and the additive-relationship paragraph at the Component Reuse Check itself.

**For a repo opting in:** the four booleans stop describing intent and start acting, at the three points where the decision is made rather than at review time. A gate can be switched on before its mechanism exists; the pre-flight will say so on every run until it does, and that is the intended adoption path rather than a defect.

**For this repo:** `architecture_adr: true` applies to the change that implements it — this ADR is that self-application. `test_evidence: true` is configured through the `ac_templates` and is never reported. `component_reuse` and `documentation` stay `false`: Markdown-only, no `components:` block, empty `docs_command`.

**Accepted cost:** `architecture_adr`'s AC text is genuinely new writing rather than a pointer, because there was nothing to point at. It is confined to one file, and every other mention links to it — the same discipline the other three gates get for free. The gate's "unconfigured" test (a missing `docs/adr/` directory) is weaker than the field checks behind the other three; it is informational and clears itself with the first ADR.

## Migration

None required. A repo without a `strategy:` block — or with one whose gates are all `false` or absent — is unaffected: no AC is injected, no pre-flight line is printed, no plan output changes. A repo with `components:` and no `strategy:` block keeps the Component Reuse Check exactly as it is (§3).

To opt in, add `gates:` to the `strategy:` block in AGENTS.md and switch on the gates whose mechanisms the repo actually has. Switching them on **one at a time is the intended path**, not a half-measure: a gate whose mechanism is not configured yet is reported on every run until it is, and never blocks one (§5). To back out, remove the `gates:` sub-block or set its entries to `false`; nothing else depends on it, and `false` is not a third state.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). New backwards-compatible behaviour across three skills: no field becomes required, no existing field is reinterpreted, no default is flipped, and an absent `strategy.gates` block preserves today's behaviour exactly. Not `patch` — in this plugin the Markdown is the runtime, and this adds an AC injection, a pre-flight report and a plan-output block that the skills did not previously produce. Not `major` — no caller breaks, and under 0.x there is no `major` bump in any case.

`version_policy`'s ADR requirement for a `minor` bump is aimed at a **default flip**, which this is not; the block stays opt-in and off by default. This ADR exists because the change is an architecture change under `architecture_adr` (§ Consequences, "For this repo"), not because the bump class demanded one.
