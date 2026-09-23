# ADR 0014 — `model:` in a SKILL.md frontmatter is optional, and no shipped skill names a model

**Status:** accepted
**Date:** 2026-08-28
**Issue:** #99
**Amends:** hard-gate 3 in `AGENTS.md` (its wording stops requiring `model:`), the Code-Style statement at the same file's "Code Style / Conventions" section (it stays optional and now says so unambiguously), and `skills/github/SKILL.md` (drops its `model: inherit` key). Supersedes nothing. **Does not touch ADR 0003** — see "The per-stage machinery is untouched".

## Context

This repo enforced a hard gate reading `SKILL.md requires YAML frontmatter (name/description/model)`, and **five of its six shipped skills carried no `model:` key**. Only `github` had one, `model: inherit`. That is a repo violating a gate it applies to every PR it reviews, and it had held for a while without visible harm — which is the concerning part, not the reassuring one. A gate nobody satisfies is a gate reviewers learn to wave through, and this repo's whole review model rests on gates being meant literally.

The gate was not the only statement on the subject. The same file's Code-Style section already read *"SKILL.md **must** carry a YAML frontmatter with the required fields `name`, `description`, optional `model`, `allowed-tools`"* — i.e. **AGENTS.md contradicted itself**: the gate made `model` required, the body called it optional. So the question was never "should a rule be weakened"; it was "which half of an existing contradiction is true". The half that matches the repo as it actually stands, and the half a maintainer wrote deliberately when describing the frontmatter, is the body's.

The competing option was to add `model:` to the five skills that lack it. It was rejected on the reason below, which is the substance of this record.

## Decision

**`name` and `description` are the required keys of a SKILL.md frontmatter. `model` and `allowed-tools` are optional. No shipped skill names a model, and `skills/github/SKILL.md` loses the `model: inherit` key it carried.**

### 1. Models change too fast to be baked into a distributed plugin

A model name is the fastest-moving fact in this ecosystem. It changes on a vendor's release schedule, not on this plugin's. A model named inside a shipped `SKILL.md` can only be changed by cutting a plugin release and having every consumer reload the plugin cache — which makes the plugin's release cadence a hostage to a vendor's, for a value that is not the plugin's to hold in the first place.

**The model choice belongs in the consuming repo's `AGENTS.md`**, per repo, where it can be changed without a plugin release and where the person who owns the trade-off (cost, latency, depth, on that repo's work) is the person who edits the file. That is the same **pure-reader** principle the rest of stagecrew already follows: the plugin ships mechanism, the repo supplies values. A model baked into a skill is a value smuggled into the mechanism.

### 2. The removed key was provably unread

`model: inherit` in `skills/github/SKILL.md` was a no-op that existed only to satisfy the mistaken gate. Nothing in this repo reads a skill's own frontmatter:

- Every frontmatter parser in the repo targets **`AGENTS.md`**, never a `SKILL.md` (`skills/work-issue/SKILL.md` pre-flight, `skills/init-agents/SKILL.md`, `skills/create-issue/SKILL.md`; the one other parse in `create-issue` reads an *issue template's* `loop-type:`, not a skill's).
- The repo states outright, in three places, that a SKILL.md frontmatter is **loader metadata deliberately not consumed by stagecrew** — that is exactly why the transclusion block in `skills/github/SKILL.md` starts below it (`skills/work-issue/SKILL.md`, "Transcluded git/gh conventions"; `docs/adr/0012-transcluded-git-conventions.md`).
- The removed key sat above the `BEGIN git_conventions` marker, outside the transcluded extent, so no rendered subagent brief changes by a single character.

Removing it is a genuine no-op for stagecrew's behaviour. What it buys is that the repo's frontmatters now agree with the repo's rule without exception, so the gate can be read literally again.

### 3. The per-stage machinery is untouched

Two different things are called "model" in this repo, and this ADR moves only one of them.

- **(a) A skill's own frontmatter `model:`** — loader metadata for the Claude Code plugin loader. This is what the gate was about and what this ADR makes optional.
- **(b) Per-stage model selection** — `work-issue.models.<stage>`, `loop_types.type_overrides.<type>.models`, and the aliases in `skills/init-agents/references/model-presets.md`, resolved by the tiers in `skills/work-issue/SKILL.md`. **Unchanged by this ADR, in every respect.** It is the intended mechanism for choosing a model, it already lives in the consuming repo's `AGENTS.md`, and ADR 0003 remains in force exactly as written.

The distinction matters beyond tidiness. The tempting way to word the corrected gate is to explain the optional `model` by pointing at the `models:` block — and that would put per-stage model advice in a second place and break hard-gate 8, whose canonical file for that advice is `model-presets.md`. So the corrected wording says `model` is optional **and stops there**. Nothing in `AGENTS.md`'s frontmatter rule mentions per-stage selection, and nothing in the per-stage documentation mentions a skill's own frontmatter.

## Consequences

**For this repo:** the gate is satisfiable and satisfied — no shipped skill names a model, and the two statements in `AGENTS.md` say the same thing. The correction is verifiable by grep rather than by reading, which is what a hard gate should be.

**For a consumer repo:** nothing changes. The shipped `skills/init-agents/references/AGENTS.md.template` never carried this gate, so no consuming repo ever inherited the mistaken requirement, and no repo's generated `AGENTS.md` needs an edit. Per-stage model selection continues to work identically.

**For a future skill author:** a new `SKILL.md` needs `name` and `description`. It should not name a model; if a stage's model matters, that belongs in the consuming repo's `AGENTS.md` per (b) above.

**Accepted cost, stated plainly:** a relaxed gate catches less. What it stops catching is a missing key that nothing read — the check was verifying a formality, and it failed five of six shipped files while doing it. A gate with a 5-in-6 false-positive rate teaches reviewers to ignore gates, and that cost is larger than the one being given up.

**A line-number consequence worth recording.** Removing one line from `skills/github/SKILL.md` falsified three line-number citations in `skills/work-issue/SKILL.md` (the transclusion markers and the prose that describes them). They were corrected in the same change. The citations remain line numbers because the surrounding text is precise about *which* line matches; that they break on any edit above them is a known, and now demonstrated, fragility.

## Migration

None. No AGENTS.md field is added, removed or reinterpreted; no default is flipped; no command changes behaviour. A `claude restart` is required after the merge, as after any `SKILL.md` change — `skills/github/SKILL.md` is edited, so a stale plugin cache would otherwise keep serving the old file.

A skill that *does* carry a `model:` key stays valid: the key becomes optional, not forbidden. Nothing has to be removed from any file outside this repo.

## Version

`patch` version bump (see `.claude-plugin/plugin.json` for the current version). Both edits are what `version_policy.patch` describes as *"everything the plugin's runtime behavior does NOT depend on"*: the gate text lives in **stagecrew's own** `AGENTS.md` — the standards this repo is reviewed against, not a shipped artifact — and the removed key is provably unread (section 2), so no rendered brief, no resolved model and no command changes.

Not `minor`: nothing here adds a skill, a loop-type, a subagent brief or an `AGENTS.md` field, and no skill's behaviour changes. The closest clause — "new required frontmatter field with a safe default" — is about an `AGENTS.md` field, and this change *relaxes* a requirement on a `SKILL.md` field rather than adding one. Not `major`: under 0.x there is no major bump, and this breaks no caller.

This ADR exists because `strategy.gates.architecture_adr` is `true` in this repo and this changes what every future PR is checked against, the same self-application ADRs 0009 to 0013 record. An ADR does not by itself force a minor — the minor rule's ADR clause is about a breaking default flip, which this is not.
