# ADR 0007 — descope the post-work close-out skill; work-issue merges in-loop

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #85 (depends on #83, #84, both merged)
**Supersedes:** #77 (already closed) — deriving a `close-out` merge order from the dependency graph; there is no merge order to derive once the skill is gone. **Supersedes by note (not by rewrite):** ADR 0004 (merge-policy) and ADR 0005 (close-out auto-resolve) — both describe machinery that no longer exists; they are left in place as historical records and not edited.

## Context

The `close-out` skill was the documented post-work lifecycle closer: it discovered wave-labelled PRs, merged them in wave order, auto-resolved strictly additive conflicts when a repo opted in, closed issues, cleaned up branches, and ran a single post-merge deploy. The default `work-issue` `merge_policy` was `defer`, meaning a Critic-approved loop **stopped at an open PR** (terminal verdict `ready-for-close-out`) and handed the merge to `close-out`; `merge_policy: auto` was the opt-in that merged in-loop instead.

A field stock-take in #75 / #77 showed the skill never actually ran:

- **0 of 208 issues across three repos ever carried a `wave:` label** — the input `close-out` keyed its merge order on. Wave production was itself retired in #84 (ADR 0006 amendment), so the last producer of that input is already gone.
- `close-out` step 1.4 exits cleanly with "nothing to close out — no wave labels found".
- The `ready-for-close-out` terminal state was reached often — **17× in `stagecrew`, 35× in a second consumer repo** — and in every case the PRs were then **merged by hand**. The documented next step of the default pipeline never executed: a clean exit that quietly handed finished work to a human.

Rather than repair a skill nobody uses — which is what #77 attempted — the decision is to remove it and let `work-issue` finish the job it already almost finishes.

## Decision

**Remove `close-out` entirely and make the `work-issue` Closer always merge in-loop.**

### 1. The skill is deleted

`skills/close-out/` is removed in full. No batch merge, no wave-order discovery, no auto-resolve of additive conflicts is re-implemented elsewhere — the behavior is removed, not relocated.

### 2. The merge default flips — the Closer always merges in-loop

With `close-out` gone, the `defer` merge policy had **no consumer**: the squash-merge, issue close, remote-branch delete and deploy that `close-out` owned would never happen. So the `work-issue` Closer now **always** merges in-loop — squash-merge to `pr_base`, issue close, remote-branch delete, and the one deploy (the former `auto` behavior becomes the only behavior).

The `merge_policy` field is **dropped entirely**, not kept as a deprecated no-op. There is exactly one merge behavior now, so there is nothing to select and nothing to fall back to — a field with a single legal value is clutter, and the single-source ethos favours removing it over documenting a graveyard. A leftover `merge_policy:` key in an existing AGENTS.md is **inert**: it was never one of the mandatory completeness fields, so it is simply not read, is never cached, and never STOPs. `defer` is therefore not left as a selectable value pointing at a removed skill, and no unknown value silently falls back — there is no field to give a value to.

The `ready-for-close-out` terminal verdict, the claim-release-on-defer path, and the "wave-agnostic, `/close-out` discovers waves" notes are removed from `work-issue`. The Closer's remaining terminal verdicts are `merged` (& deployed) and `ESCALATE: CI pending` (the one exit that leaves a PR open — the claim is released and the Pre-Flight open-PR check routes a re-run straight to the merge, unchanged from the old `auto` resume).

Canonical definition of the new behavior: `skills/work-issue/SKILL.md`, section "Closer merge behavior (in-loop merge)".

### 3. References removed

The `wave:<n>` label contract lived in `close-out`; that contract dies with the skill, so this repo's AGENTS.md single-source hard-gate entry that named `skills/close-out/SKILL.md` as its canonical home is removed too. Close-out and `merge_policy`/`defer` references are removed from `work-issue`, `run-loop`, `loop`, `plan-issues`, `create-issue`, `init-agents`, `README.md`, `CLAUDE.md`, and the `skills/init-agents/references/AGENTS.md.template` (both the `merge_policy` field and the commented `close-out:` namespace).

## Consequences

**Backwards compatibility:**

- A repo that set `merge_policy: auto` sees **no behavior change** — the Closer merged in-loop then and merges in-loop now.
- A repo on the old `defer` default (including any AGENTS.md with no `merge_policy` field at all) now gets **in-loop merge** instead of an open PR handed to a human. This is the deliberate default flip. The migration path is that the Closer now performs the merge / issue-close / branch-delete / deploy that `close-out` used to own — no manual merge step is required any more.
- Any `merge_policy` key still present in an AGENTS.md is ignored rather than rejected, so no existing repo fails a pre-flight because of it.

**What is given up, on purpose:** the batch, ordered, one-deploy-per-run merge and the opt-in additive-conflict auto-resolve. The field evidence is that neither was used; a repo that genuinely wants a batched, ordered merge across many PRs merges them by hand or with its own tooling, exactly as every real run already did.

## Migration

None required to adopt the new behavior — it is automatic. To silence a now-inert field, delete the `merge_policy:` line from your AGENTS.md (optional; leaving it does nothing). There is no opt-in that restores `close-out`: the skill is removed, and the field evidence is that no repo relied on it. Per `version_policy`, where an opt-in is genuinely impossible (a removed skill), that impossibility is recorded here and the change ships as `minor`.

## Version

Ships as **`minor`** under `version_policy` (see `.claude-plugin/plugin.json` for the current version). It is a deliberate, documented **default flip** (`defer` → in-loop merge) plus a **removed skill** — both of which under 0.x ship as minor provided (a) an ADR records the flip (this ADR) and (b) either the old behavior stays available as an explicit opt-in or, where an opt-in is impossible, that impossibility is recorded. The old behavior cannot be an opt-in because the skill that provided it is removed, so this ADR records that and the migration path (the Closer now does what `close-out` did). Under 0.x there is no `major` bump: the leading zero is the compat signal, and the minor rule's ADR-plus-migration test is met.
