# ADR-0003: Optional Per-Stage Model Selection in AGENTS.md

## Status

Accepted.

> **Canonical source note:** the current recommended mapping and preset definitions live in
> `skills/init-agents/references/model-presets.md`. The mapping quoted in the Schema section below
> is the one that applied when this decision was taken; the canonical file is the live source.

> **Superseded in part by `docs/adr/0018-implementer-model-default.md`** (2026-09-03): the recommended
> Implementer tier moved from `fable` to `opus`, `economy` moved its Implementer to `sonnet` and
> returned its Critic to `opus`, and `fable` became a deliberate escalation carried only by
> `quality`. Everything below — including the Schema mapping and the battle-test observations — is
> left exactly as written: it is the record of what applied and what was observed at the time, not a
> live recommendation. A second axis was added alongside `models:` in
> `docs/adr/0017-per-stage-effort-axis.md`.

> **Superseded in part by `docs/adr/0021-delegation-rule-and-spawn-visibility.md`** (2026-09-03): the
> "Nested subagents" section below described the arrangement that applied then — one inheritance note
> restated in each subagent brief. That rule now has a single canonical home, transcluded into every
> stage briefing that can spawn, and it covers when a nested spawn is warranted and what the stage
> records about it as well as what it inherits. The section below is left as written: it is the record
> of what applied at the time, not a live description.

## Context

Every stage of `/work-issue` runs on whatever model happens to be active in the caller's session. That is wrong in both directions at once: the Critic — the gate that decides APPROVE vs. REVISE — runs on the same model as the Closer, which only opens a PR, merges it, and deletes a branch. A weak Critic waves through unverified claims; a false APPROVE is worse than no Critic because it produces an audit trail for bad work. A strong Closer burns tokens on `gh` calls it does not need.

The loop already knows its own stage semantics. Three stages are purely **mechanical** (Tester: run commands and report exit codes; Closer: PR, merge, branch cleanup, label hygiene; even the Implementer on a code diff is primarily throughput-work that the build and the Critic verify afterwards). Two stages are **judgment gates** (Validator: spec vs. repo reality; Critic: correctness, quality, and security across the full diff). One is **evidence-critical** in a way that is unique to the research loop (Researcher/Implementer: must not restate unverified numbers as fact).

There is a concrete, measurable cost to mismatching stage and model: a Critic on a weak model produces optimistic verdicts that let regressions through; a Researcher on a weak model fabricates citations. Neither failure is caught until the PR is already merged or the findings doc is already filed.

The loop should carry the model decision explicitly — as an opt-in AGENTS.md block — instead of leaving it to session luck.

## Decision

Introduce an optional `models:` block inside the `work-issue:` YAML frontmatter namespace of AGENTS.md. Absent block → every stage inherits the session model (zero behavior change for every existing AGENTS.md file). Present block → the resolved alias is passed as the `model:` parameter at each stage's subagent spawn site.

### Schema

```yaml
work-issue:
  models:                # optional; absent = every stage inherits the session model
    validator:   sonnet
    implementer: fable
    tester:      haiku
    visual:      sonnet  # only used when the visual: gate fires; unused otherwise
    critic:      opus
    closer:      haiku
```

### Alias constraint

**Aliases only** (`opus`, `sonnet`, `haiku`, `fable`) — never a pinned model id. Pinned ids rot on the next model release and would silently degrade every consumer repo. An unknown alias is treated identically to an absent value: fall back to inherit, note it in the stage comment, never STOP.

### Graceful degradation

Unknown / unavailable / rejected alias → fall back to inherit, note it in the `[stage:<name>]` comment, and continue the loop. A model preference must never break a loop. This mirrors the existing graceful-degradation rules for the code-graph MCP and the Playwright MCP: prefer-and-degrade, never hard-fail.

### Resolution order

The `models:` block participates in the existing 2-tier standards source (L1 AGENTS.md → L2 issue `## Standards Override`). Model resolution follows the same right-wins merge:

1. `work-issue.models.<stage>` from AGENTS.md (L1 base).
2. `loop_types.type_overrides.<loop_type>.models.<stage>` from AGENTS.md (L1 type layer — already part of L1, not a new tier).
3. `models.<stage>` in the issue's `## Standards Override` block (L2, one-shot per issue).
4. Nothing set at any layer → inherit the session model.

### `code` vs `research` split

Research Implementers and code Implementers are not the same job. A code diff is verified by a build (the Tester) and a diff review (the Critic) — a throughput-grade model is sufficient. A research findings doc must cite verifiable evidence; a weaker model restates unverified numbers as fact, and the Critic cannot always catch fabricated citations.

The split is expressed via the existing `loop_types.type_overrides.research.models` key — no new mechanism:

```yaml
loop_types:
  type_overrides:
    research:
      models:
        implementer: opus
        critic:      opus
```

### Not part of the mandatory pre-flight

`models:` is **not** part of the mandatory 11-field completeness check in `/work-issue`. A missing block must never STOP. This follows the same pattern as `commit_identity` — the only other optional field in the `work-issue:` namespace.

### Auditability

Each `[stage:<name>]` comment records the model that actually ran:

- Normal: `model: opus`
- Fallback: `model: inherited (opus requested, unavailable)`
- No override: `model: inherited`

### Nested subagents

If a stage subagent spawns its own agents (e.g., a fan-out Implementer), those fall back to the session model. The `model:` parameter is not propagated automatically. The stage brief must explicitly pass `{{model}}` to nested spawns if the same override is desired. This is documented in all three subagent briefs.

### Retrofit path

Existing repos add the block via `/init-agents --models` without re-running the full init dialog. Four presets cover the common cases: `balanced` (recommended mapping), `economy` (cheapest viable tier, Critic still one tier above), `quality` (top tier for judgment stages), `inherit` (removes the block, clean opt-out). `/init-agents --refine` offers the block when absent but never writes it autonomously.

### Version bump

`minor` per `version_policy` — new AGENTS.md field with a safe default (absent = zero behavior change), new skill behavior that is backwards-compatible for existing AGENTS.md files.

## Alternatives considered

### Alternative A — new loop-type `quality` with a hardcoded stronger model

A fourth loop-type (`quality`) that always runs Critic on opus.

- **Pros:** discoverable via `--type=quality`; no new AGENTS.md field.
- **Cons:** the loop-type axis is *deliverable shape* (code diff vs. findings doc), not *model budget*. Forking the pipeline on model budget duplicates the entire code-implementer / Tester / Critic / Closer for a single-field difference. Rejected — wrong axis.

### Alternative B — pinned model ids in the block

Allow pinned model ids (e.g. a specific version string) in the block for exact reproducibility.

- **Pros:** exact control; a repo can pin to a specific checkpoint.
- **Cons:** model ids rot. When the next generation ships, pinned ids in consumer repos silently degrade (model not found → error or silent fallback). The alias layer (`opus`, `sonnet`, etc.) is already a stable indirection managed by the platform. Rejected — pinned ids are an anti-pattern for a plugin shipped to arbitrary users.

### Alternative C — per-skill config (not per-stage)

A single `model: opus` field at the `work-issue:` level, applying to all stages.

- **Pros:** simpler schema; one key.
- **Cons:** eliminates the entire value proposition. The point is that the Critic should be strong and the Closer should be cheap. A single key forces a choice: cheap everywhere (quality loss) or strong everywhere (cost loss). Rejected.

### Alternative D — auto-detect model from issue complexity

Infer the model from the issue's AC count, LOC estimate, or loop-type.

- **Pros:** no new AGENTS.md field; adapts per-issue.
- **Cons:** non-deterministic; a later reader cannot audit "what model produced this verdict" reliably; the issue complexity proxy is unreliable (a 2-AC issue can be a hard correctness gate); no user control. Rejected — user control and auditability are explicit requirements.

## Consequences

### Immediate

- New AGENTS.md field, opt-in, backwards-compatible. `minor` version bump (see `.claude-plugin/plugin.json` for the current version).
- `skills/work-issue/SKILL.md` gains the model-resolution logic, the per-stage dispatch note, the graceful-degradation rule, and the `[stage:<name>]` audit record.
- `skills/init-agents/SKILL.md` gains the `--models` flag, the four presets, the retrofit path, and the `--refine` offer behavior.
- `skills/init-agents/references/AGENTS.md.template` ships the block commented out with the recommendation table inline.
- All three subagent briefs gain the `{{model}}` placeholder and the nested-subagent inheritance note.
- `AGENTS.md` (this repo) gains this "Model Selection" documentation section.
- `CLAUDE.md` documents the new field and the `--models` invocation.
- This ADR.

### Loop cost

- Zero overhead in repos without a `models:` block. Every stage inherits the session model as before.
- When set: one model-alias lookup per stage dispatch (string map key — negligible).
- The `[stage:<name>]` comment gains one `model: <alias>` line — negligible token cost.

### Follow-ups (out of scope for this ADR)

- Model selection for non-loop skills (`/create-issue`, `/plan-issues`, `/run-loop`, `/close-out`) — separate issue if wanted.
- Cost accounting or token telemetry — the block expresses a preference, it does not measure or report spend.
- Auto-detection of which model a repo "should" use — `/init-agents` proposes presets, it never infers a mapping from the codebase.
- Version-pinning strategy for model aliases — not planned; the platform manages the alias → checkpoint mapping.

## Battle-test observations

**n=1 from a single real run** — issue #23 in this repo (stagecrew), which shipped the `models:` block itself, run with the mapping as originally specified: `validator: sonnet / implementer: fable / tester: haiku / critic: opus / closer: haiku`.

### Failures observed

1. **Tester (`haiku`) returned PASS on a materially unmet AC.** Issue #23 required every `[stage:<name>]` comment to record the model that ran. The Implementer had added the line to the three subagent brief *files* but not to the four inline briefing templates in `skills/work-issue/SKILL.md` — so four of six stages would never have emitted it. The Tester verified that the line existed somewhere in the diff and passed. The `opus` Critic caught it ([REVISE, item 1, #23](https://github.com/Domek-Labs/stagecrew/issues/23#issuecomment-5077152946)). In the revise round the Tester passed a second time, again without establishing that the line would actually be emitted from the templates.

2. **Closer (`haiku`) recorded a false merge commit.** Its `## [stage:closer] merged` comment named `c3c1fe3` as the merge commit. `c3c1fe3` is the pre-merge head of `main` (PR #22). The real squash-merge commit is `d6a78f0`. The merge itself was correct; the audit log was wrong ([correction, #23](https://github.com/Domek-Labs/stagecrew/issues/23#issuecomment-5077196425)).

The common failure mode was not that the tasks were hard edge cases. The Tester's job is to determine whether a claim holds against reality — distinguishing "the string is present" from "the rule is effective" is a judgment task. The Closer's job includes reporting what commands produced — a merge SHA, an issue state — which is also not purely mechanical once the output must be verified rather than just executed.

This falsifies the premise recorded in the Context section above — that the Tester and the Closer are "purely mechanical". Per ADR discipline that section is deliberately left as written: Context records the reasoning as it stood when the decision was taken; this section records what the run showed. Where the two conflict, this section is the later evidence.

### Results that held

- **`opus` Critic caught a defect no other stage caught, twice.** In the initial round it found the inline template gap the `haiku` Tester had passed. In the revise round — after the Implementer addressed the first set of findings — it caught a *new* defect the Implementer had introduced in its own revision. Neither was visible in the diff at a surface level; both required reading the SKILL.md templates against the stated AC. The gate functioned as designed.

- **`fable` Implementer produced a correct diff whose only defects were caught downstream** — including one it introduced while fixing the first set. The build passed, the overall structure was sound, and the defects that were found (by the Critic) were in secondary wiring, not in the core feature. This matches the assumption in the `code` vs `research` split: a throughput-grade model on a code diff, with the Critic as the correctness gate, is the right division of labour. It also shows what that division costs — the Implementer's revise round is itself a source of new defects, so the gate has to run again after every revision, not only on the first submission.

### Limits of this evidence

Beyond n=1: every observation here was produced inside the loop being evaluated and recorded by the stages being evaluated.

- The "`opus` Critic caught a defect no other stage caught" result is that Critic's own report of its own work. No `sonnet` or `fable` Critic was run against the same diff, so this run does not show that a cheaper Critic would have missed the defect — only that the `opus` Critic did not.
- The finding that condemned the `haiku` Tester came from the `opus` Critic, and the resulting recommendation preserves `opus` on the Critic. The recommendation is not independent of the stage it favours.

Nothing here is a controlled comparison. These are one loop's field notes, not a tier ranking.

### Resulting mapping change

`tester` and `closer` are moved from `haiku` to `sonnet`. `haiku` remains a valid alias — this change is to the recommended mapping only, not to the schema. The canonical source is `skills/init-agents/references/model-presets.md` (updated in issue #25).
