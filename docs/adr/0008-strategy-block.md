# ADR 0008 — the optional `strategy:` block: strategic software development as one opt-in home

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #90 (blocks #91, #92, #93)
**Amends:** adds an optional top-level `strategy:` namespace to the AGENTS.md schema, and — for the `feature:` axis only — a deliberate, bounded exception to ADR 0006 §5 (recorded in §4 below). Supersedes nothing.

## Context

"Strategic software development" is the working name for the thing this plugin keeps almost doing: architecture, planning, documentation, building-block size, component reuse and test evidence considered **from the ground up**, rather than reconstructed after a loop has already shipped.

Every hook for that already exists in the schema — and that is the problem. They are scattered across four unrelated fields with four different shapes:

- the **ADR practice** under `docs/adr/`, a convention with no field at all;
- **`components:`**, an opt-in block about reuse (ADR 0001);
- **`smoke_test`** and **`ac_templates`**, two `work-issue:` fields about evidence;
- **`docs_command`**, a `work-issue:` field about derived documentation.

Nothing ties them together, so a repo adopting the strategic posture has to discover four separate decisions and get each one right independently. There is also no axis at all for the unit the whole posture is organised around — the **feature** an issue belongs to.

The available alternatives were both worse. Building new enforcement machinery would duplicate four mechanisms that already work. Writing a prose "strategy guide" would produce advice with no field behind it, and the single-source hard-gate would then have to police prose against four canonical files.

## Decision

**Introduce an optional top-level `strategy:` block in AGENTS.md.** Absent block = zero behavior change, on the same axis as `components:`, `visual:` and `models:`. The block's shape and opt-in semantics are canonical in this repo's **`AGENTS.md`**, section "Strategic Software Development (optional `strategy:` block)" — one home, per hard-gate 8.

The #90 decision shipped the **schema and its description only**. At that point nothing read the block, and the consumers were follow-up issues (#91 feature-axis behavior, #92 gate enforcement and #93 the `/init-agents` offer — all three have since landed; #93 is recorded in `docs/adr/0010-init-agents-design-docs.md`). That split is deliberate: the schema has to exist and be agreed before three skills start branching on it.

### 1. The four gates are pointers, not new machinery

`gates:` carries four booleans — `architecture_adr`, `component_reuse`, `test_evidence`, `documentation`. Each one switches an **existing** mechanism from optional to strategically-required. None of them defines behavior of its own, and none of them restates its target's contract: `component_reuse` points at `components:`, `test_evidence` at `smoke_test` / `ac_templates`, `documentation` at `docs_command` plus the docs `ac_template`, and `architecture_adr` at the ADR practice these files already follow.

This is what keeps the block legal under the single-source hard-gate. A gate that described *how* component reuse is enforced would be a second canonical source for ADR 0001; a gate that only says *whether it is required here* is not.

The corollary is stated rather than hidden: a `true` whose underlying mechanism is not configured — `component_reuse: true` in a repo with no `components:` block — has nothing to enforce. It is reported, never a STOP. A boolean cannot conjure a mechanism, and pretending otherwise would turn a documentation field into a trap.

### 2. Feature size is an issue-level question, not a feature-level count

`feature_axis.flag_over` is **soft by construction**: crossing it produces a note in `/plan-issues`, never a STOP.

The temptation was to make a high open-issue count per feature mean "this feature is too big". It does not. A feature with many open issues is often simply a feature being worked on; a feature with two issues can be hopelessly over-scoped. The signal that actually correlates with unmanageable size is already caught one altitude lower, at the issue, by the **epic trigger** in `skills/create-issue/SKILL.md` (label `epic`, or too many files-to-touch, or an over-long spec block). Duplicating that judgement at feature level would add a second, weaker detector for a problem the first one already catches — and a blocking one at that.

So `flag_over` stays what it honestly is: a count worth looking at, not a verdict.

### 3. Design docs are captured in the AGENTS.md body, not reconstructed as documents

`design_docs.prd` / `design_docs.sdd` are **pointers, not containers**. They follow the three-state convention `docs_command` established: a path means "this document exists, here it is"; `""` means "decided: this repo has no separate PRD"; absent means nobody has decided yet.

What they deliberately do **not** do is invite a PRD or SDD to be written for a repo that never had one. A reconstructed design document is the described-docs failure mode in its purest form: it can go wrong silently, and nobody notices because nobody reads it. The strategic essence — architecture, conventions, known traps — belongs in the **Markdown body of AGENTS.md**, which every stage of every loop already loads as context. A field pointing at a real, maintained PRD is useful; a field that pressures repos into producing one is not.

### 4. The feature axis is configured under `strategy:`, while its label contract stays in `plan-issues`

ADR 0006 §5 established that issue-label **vocabulary** sits in the `plan-issues:` namespace, because that is the repo's issue vocabulary. `feature_axis.prefix` breaks that placement on purpose, and the boundary is recorded here so a later reader is not left guessing:

- **The switch belongs to `strategy:`.** The feature axis is not an independent taxonomy — it is the organising unit of the strategic framework, and it is turned on and off *with* that framework. A repo that has not opted into strategic decomposition should not end up carrying a half-configured feature vocabulary it never asked for. Putting `prefix` / `require_on` / `flag_over` under `plan-issues:` would separate the axis from the decision that creates it, and `strategy:` would then be a block that switches on a mechanism configured somewhere else.
- **The label contract belongs to `skills/plan-issues/SKILL.md`.** Grammar, cardinality, lifetime, the legal sources a `feature:` label may come from, and the retirement rule are canonical **there**, beside the `area:` / `bundle:` and `goal:` / `waiting-on:` contracts. One file holds every issue-label contract, per hard-gate 8. Neither the `strategy:` block nor its description restates any of it.

Stated as one line: **`strategy:` owns whether and how the axis is switched on; `plan-issues/SKILL.md` owns what the label means.** Configuration placement and contract ownership are different questions, and ADR 0006 §5 answers only the second.

Consistent with ADR 0006 §4, the prefix is configurable (default `feature:`), so a repo keeps its vocabulary in its own language while this plugin stays English-only.

### 5. The template block is a named copy artifact

`skills/init-agents/references/AGENTS.md.template` carries the commented `strategy:` block, because a template has to be readable standalone and cannot substitute a pointer for the shape it provides. It is named as a copy artifact at both ends — in the template itself and in hard-gate 8's enumeration in this repo's AGENTS.md, which this decision extends from two permitted copies to three. The two files change together.

## Consequences

**For existing users:** nothing to set, nothing to migrate. With no `strategy:` block every skill behaves exactly as before. At the time of this decision that held even *with* a block, since no skill read it yet; as the consumers landed, a declared block started to act — the feature axis first, with #91, then the gates with #92, and finally the bootstrap offer with #93.

**For a repo opting in:** the four strategic decisions become one visible, reviewable block instead of four scattered fields, and the feature axis gets a configurable home. What the #90 decision did **not** yet give was enforcement: `require_on`, `flag_over` and the four `gates:` booleans described intent until their consumers shipped. #91 has since made `require_on` and `flag_over` real in `/create-issue` and `/plan-issues`, and #92 has made the four `gates:` booleans real across `/create-issue`, `/work-issue` and `/plan-issues` — see `docs/adr/0009-strategy-gates.md`, which is where every consequence of that step is recorded. #93 then made the block reachable at bootstrap: `/init-agents` offers it, and §3's "captured in the body, not reconstructed" becomes a dialog rather than a principle — see `docs/adr/0010-init-agents-design-docs.md`.

**For this repo:** stagecrew declares a `strategy:` block as the dogfood — `architecture_adr` and `test_evidence` `true` (both mechanisms are real here), `component_reuse` and `documentation` `false` (Markdown-only, no `components:` block, empty `docs_command`). Declaring a gate `false` where the mechanism does not exist is the honest state, and exercising it in the dogfood is the point.

**Accepted cost:** a fifth optional block adds schema surface, and one field (`feature_axis.prefix`) now sits away from the namespace ADR 0006 §5 would predict. §4 above is the mitigation — the exception is bounded to placement, and the contract ownership it might otherwise erode is restated as unchanged.

## Migration

None required. To opt in, add to `AGENTS.md`:

```yaml
strategy:
  feature_axis:
    prefix: "feature:"
    require_on: [enhancement]
    flag_over: 10
  design_docs:
    prd: ""
    sdd: ""
  gates:
    architecture_adr: true
    component_reuse:  true
    test_evidence:    true
    documentation:    true
```

Partial blocks are legal — omit any sub-block you have not decided on. To back out, remove the block; nothing else depends on it.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). A new optional AGENTS.md block, fully backwards-compatible: no field becomes required, no existing field is reinterpreted, and an absent block preserves today's behavior exactly. Not `patch` — in this plugin the Markdown is the runtime, and this adds schema that three follow-up issues will branch on. Not `major` — no default is flipped and no caller breaks; under 0.x there is no `major` bump in any case.
