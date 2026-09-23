# ADR 0022 — the Validator gains two spec-time gates: every AC names its observable, every test names its execution path

**Status:** accepted
**Date:** 2026-09-15
**Issue:** #68
**Amends:** the Stage 1 (Spec Validator) briefing in `skills/work-issue/SKILL.md` — two existing gate checkboxes ("ACs are testable", "Test plan present") gain criteria; no gate row is added, no gate is removed. Also amends the spec dialog in `skills/create-issue/SKILL.md` (Test Plan question split in two) and the `code`/`research` issue templates (pointers to the amended gate). Supersedes nothing.

## Context

The Validator is the only stage that reads the spec before any code exists. Its two relevant gates — "ACs are testable (every checkbox concretely verifiable)" and "Test plan present" — test for **presence**, not for a named observable and a named execution path.

Observed in a repo driven by this plugin: a page check written inside a completed loop never ran in CI at all — the browser it needs is provisioned only after the test job. The loop reported green because nothing executed. The issue that produced that test had a Test Plan; it named a command. It did not say where that command runs, and nothing required it to. Against the gate list as it stood, that issue was faultless: the checkbox was verifiable *in principle*, and the Test Plan section was non-empty.

This is the spec-time half of the problem. The run-time half — proving a named test actually executed and actually depends on the change — is `#65`'s (the Tester/Closer evidence counterpart); the two are deliberately split by stage and, where they touch the same file, sequenced rather than parallelised.

## Decision

**Both gates are extended in place. No gate row is added, no Validator verdict is added, no AGENTS.md field is added.** The full gate text, including the STOP messages, is canonical in `skills/work-issue/SKILL.md`, Stage 1 briefing — this ADR records the decision and its shape, not the procedure.

### 1. "ACs are testable" now requires a named observable

A checkbox must name what will be looked at to decide it — a command's output, a file at a path, an HTTP status, a log line, a rendered screenshot. A checkbox whose only conceivable proof is "the Implementer states it is done" is a STOP. The STOP text quotes the offending checkbox **verbatim**, never a category, and proposes a concrete rewrite — this was a deliberate choice over a generic "AC not testable" message, because a category-level STOP gives the Implementer nothing to act on and this repo has already seen vague STOP text produce a second, equally vague, revision.

### 2. "Test plan present" now requires an execution path per new or changed test

Three legal forms, all explicit, and the second is deliberately legal rather than merely tolerated: `run by <command> locally and in CI job <name>`, `run by <command> locally only — not executed in CI`, `not executed automatically — manual verification, steps below`. Declaring "local only, not in CI" is the fix — it is exactly the statement the failure-mode issue never made, and making it costs nothing while making the coverage gap visible to a human before merge instead of after. The third form requires the steps; a bare "manual verification" with nothing under it is a STOP, for the same reason a bare "the Implementer states it is done" is a STOP under gate 1: a claim with no observable is not a plan.

### 3. Degradation for a repo with no executable test command

Where `smoke_test` resolves to a no-op (`true`, `:`, or the empty string — this repo's own case), the gate requires the **statement**, not a command: "structural inspection only" is an acceptable execution path. Without this, the gate would be unsatisfiable for a documentation-only repo, which would make it a de facto STOP on every Markdown-only issue this repo itself files — including this one.

### 4. Producer side: `/create-issue`'s Test Plan question splits in two

Question 4 ("Test plan") becomes two questions: what proves it, and where that proof is produced (the new question 5). All subsequent spec-dialog questions renumber by one (5→6 … 10→11), and every cross-reference to a question number in `skills/create-issue/SKILL.md`, its two issue templates, `skills/plan-issues/SKILL.md` and `CLAUDE.md` was updated to match. This is the standard division of labour the skill already declares — the producer is opinionated, the Validator stays strict — applied to the one field this issue found underspecified. The Validator gate remains the enforcement point; `/create-issue` asking for the answer up front is what makes the Validator rarely have to STOP for it, not a second copy of the rule.

### 5. Single source, held under the drift test

The three legal forms and the two STOP texts are stated once, in the Validator briefing. `skills/create-issue/SKILL.md`'s new question 5 and `references/issue-templates/code.md`'s `## Test Plan` section describe that the three forms exist (a `code`, `local-only`, `manual` label under short, non-literal wording) and point at the canonical section rather than repeat its exact strings — repeating the verbatim forms in two files would fail the drift test in AGENTS.md's `ac_templates` gate (hard-gate: "a mention is a copy if it would have to change when the advice changes"). `references/issue-templates/research.md` gets the same pointer, scoped to the one case the research loop type actually has: an executable probe under spec sections 1 or 3. The research `### Research-specific (required)` doc-quality checklist is untouched — it is a different mechanism, verifying document content, not the execution-path gate.

## Consequences

**For every `code`-loop issue, on every Validator run:** two checkbox criteria carry more text, and a spec that under-specifies either an AC's observable or a test's execution path now produces a STOP with a concrete, quoted rewrite suggestion instead of passing silently.

**For `research`-loop issues:** unchanged in the common case (a findings document with no executable probe). Where a findings document does propose an executable probe, that probe's execution path is checked the same way a `code` test's is; the doc-quality checklist that already exists for research issues is not touched by this change.

**For issues authored through `/create-issue`:** the split Test Plan question means most issues arrive with an execution path already stated, so the Validator STOP on gate 2 becomes the exception rather than something every spec-writer has to discover by being STOPped once.

**For issues authored by hand or through `--refine`:** unchanged mechanically — the Validator gate applies regardless of how the issue was produced. A hand-written issue with a Test Plan reading only "run `pytest tests/test_pages.py`" now STOPs; adding "— run by pytest locally and in CI job build" or the explicit "not executed in CI" statement clears it.

## Alternatives considered

- **A new Validator verdict** (e.g. `GO-with-caveat`) for an issue with a legal-but-incomplete-CI-coverage Test Plan. Rejected: the verdict set is `GO`/`STOP` and this issue's own "must not change" list forbids adding to it. The `run by <command> locally only — not executed in CI` form already expresses the caveat inside the existing `GO` outcome — it is a statement, not a third verdict.
- **A new AGENTS.md field** (e.g. `require_ci_execution_path: true`) to make the gate opt-in per repo. Rejected: both gates read only what is already in the issue body and the already-resolved `smoke_test` value; no new configuration surface was needed, and the issue's spec explicitly rules this out.
- **Requiring CI execution for every test** (rejecting the "local only — not executed in CI" form as illegal). Rejected: that would make the gate unsatisfiable for any repo or any test category that genuinely has no CI path yet (exactly the case the failure-mode issue was in), trading a silent gap for an unfileable issue instead of a visible, honest one.
- **Enforcing this only at run time** (Tester/Critic, proving a named test executed), skipping the spec-time gate entirely. Rejected as the sole fix: it catches the failure only after the Implementer has already built against an unexecuted test plan. The spec-time gate (this issue) and the run-time evidence (`#65`) are complementary, not substitutes — a spec-time gate that is not backed by run-time proof can still be satisfied by a plan that is followed only on paper, which is why both issues exist and are sequenced against each other rather than merged into one.
- **Restating the three forms verbatim in `code.md` and the spec dialog**, matching this issue's Files-to-Touch wording ("documents the three forms") literally. Rejected in favor of a pointer with short non-literal labels: a verbatim copy in two more files would violate this repo's single-source hard gate and fail the drift test the first time the canonical wording changed.

## What would reverse this

- The gate producing STOPs on a material share of well-specified issues (false positives on issues that do have a real, if implicit, execution path) → loosen the observable/execution-path criteria or widen the legal forms, recorded in an amending ADR.
- The `/create-issue` question split proving confusing or redundant in practice (users answering "where" identically to "what" every time) → collapse questions 4 and 5 back into one question with two inline prompts, without touching the Validator gate itself.
- `#65`'s run-time evidence mechanism turning out to make this spec-time gate redundant (e.g. if run-time proof alone is sufficient and cheaper to check) → this gate could be relaxed to a warning; that call belongs to whoever implements #65 and observes the two mechanisms in combination.

## Migration

None required. Both gates read fields the issue body and AGENTS.md already carry — no existing AGENTS.md file needs an edit, and no existing issue is retroactively checked (the issue's Out of Scope explicitly excludes retrofitting the section onto already-open issues). A repo upgrading this plugin gets the extra gate criteria on its next `/work-issue` run and the extra spec-dialog question on its next `/create-issue` run, and nothing else changes.

## Version

`minor` version bump (see `.claude-plugin/plugin.json` for the current version). Changed stage-gate criteria in the Validator briefing plus a changed template section (`code.md`'s `## Test Plan` details) is a `minor` bump per `version_policy` in AGENTS.md: no field becomes required, no existing field is reinterpreted, no default is flipped, and an issue that already named an observable and an execution path passes exactly as it did before. Not `patch` — the Markdown is this plugin's runtime, and this changes what the Validator subagent is instructed to check on every run. Not `major` — under 0.x there is no `major` bump in any case.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this is a behaviour change to a stage gate, the same self-application ADRs 0009, 0011 and 0020 record.
