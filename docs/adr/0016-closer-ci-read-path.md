# ADR 0016 — the Closer reads CI state from `actions/runs`, because the Checks API is unreachable for a fine-grained token

**Status:** accepted
**Date:** 2026-09-03
**Issue:** #111

## Context

The Closer's CI base-vs-PR baseline read the Checks API:

> `gh api repos/<slug>/commits/<pr_base>/check-runs --jq '.check_runs[] | {name, conclusion}'`

That call **cannot succeed with a fine-grained personal access token**. Measured against this repository on 2026-09-03, reading GitHub's own `X-Accepted-Github-Permissions` response header rather than inferring from documentation prose:

| Call | Result | Accepted permission |
|---|---|---|
| `commits/<ref>/check-runs` | **403** | `checks=read` |
| `commits/<ref>/check-suites` | **403** | `checks=read` |
| `actions/runs` | 200 | `actions=read` |
| `commits/<ref>/status` | 200 | `statuses=read` |

`checks` is **not among the permissions a fine-grained token can be granted.** The error text distinguishes the two cases itself — *"Resource not accessible by personal access token"*, not "insufficient permission" — and the Checks API belongs to the App model.

**Why it went unnoticed for so long.** The plugin was developed in a container backed by a GitHub App, which *can* hold `checks`. In a project container carrying one token per repository — the cut this plugin itself recommends — the same step fails. And it failed **quietly**: in the loop that first hit it, the 403 was worked around by hand, the absence of readable checks was very nearly recorded as success, and the remedy advised to the operator was to grant a permission that GitHub does not offer. That near-miss is the reason this ADR insists on a named `unknown` state.

## Decision

**Read CI state from `repos/<slug>/actions/runs?head_sha=<full-40-char-sha>` (`actions=read`), and resolve every read to one of four states, in this order: unknown, pending, failed, passed.**

Six parts, each load-bearing:

1. **The full 40-character SHA is mandatory.** An abbreviated SHA returns an empty result with no error — `head_sha=c1750d5` gave `total_count: 0` where the full SHA gave `2`. A short SHA therefore manufactures the exact absence-read-as-green failure this decision exists to remove.
2. **The read is paginated.** `total_count` comes from the response envelope while `workflow_runs` is one page, GitHub documents the default as 30 (documented, not measured here). On a SHA with more runs than that a `failure` can sit off-page while the count looks complete — the same silent-green family. The documented call pages explicitly.
3. **Same-named runs collapse: a name passes only if every run of that name passes.** One workflow yields one run per triggering event, so a PR head normally carries two runs named alike (`push`, `pull_request`), while the comparison keys on the check name. Preferring the newest, or a particular event, would let a green `push` mask a red `pull_request` on identical code. And two runs of one workflow disagreeing on one commit means the check is environment-dependent, which is itself worth blocking on.
4. **Four states, not three, and the passing set is an allowlist.** `unknown` / `pending` / `failed` / `passed`, resolved in that order. An earlier draft of this decision defined `passed` as "no run concludes `failure`" — which reads an unfinished run (`conclusion: null`), a `cancelled` run and a `timed_out` run as green, and would have merged before CI finished. The passing set is therefore `success`, `neutral`, `skipped` and nothing else, so a conclusion value GitHub adds later defaults to not-passing. `pending` is retained because the rest of the skill depends on it (the bounded poll and `ESCALATE: CI pending`).
5. **`unknown` is never green.** It covers both a failed fetch (403, network loss, malformed response) and `total_count == 0`. A commit with no runs has passed nothing: `45ac33e`, the commit before this repo's workflow existed, returns zero runs. An `unknown` read is reported as a finding in the stage comment and every red check blocks.
6. **A fetch failure is reported, never silently substituted.** The Closer names the cause and falls to the safe side rather than reaching for another source without saying so.

## Alternatives considered, and why each was rejected

**`commits/<ref>/check-runs` — the incumbent.** Unreachable, as measured above. Keeping it and asking operators for the permission is not an option: the permission does not exist for the access model this plugin recommends.

**`commits/<ref>/status`.** Reachable (`statuses=read`) and rejected on evidence. It **cannot see Actions at all**. Measured on a commit whose Actions run concluded `failure`, it reported `state: "pending"` with `statuses: 0` — a definitive red presented as "still waiting". A Closer built on it would poll to its cap and escalate as CI-pending on a commit that had unambiguously failed. It also cannot separate "no statuses exist" from "a status is running" other than through `.statuses | length`, because `pending` is its default for an empty set.

**GraphQL `statusCheckRollup`.** The aggregate `state` is readable, and so is `contexts.totalCount`, but every individual `CheckRun` node returns `null` with `FORBIDDEN`. It answers "is it green" and cannot answer "which check", so it cannot support a per-check base-vs-PR comparison — the rule is not a green/red gate but a comparison of named checks across two refs. Adopting it would silently replace the documented behaviour with a coarser one. `gh pr checks` is the CLI wrapper around the same query and fails identically once check runs exist; it succeeds on a repository that has none, which is its own instance of absence-read-as-green.

**Combining `actions/runs` with `commits/<ref>/status`** to widen coverage was considered and not adopted here. It would add visibility of external *commit statuses* while still missing external *check runs*, at the cost of a second source whose `pending` default is a live trap. If a consumer needs external commit statuses, that is a deliberate extension — not the default.

## Consequences

**What is gained.** The step works under the access model this plugin recommends, and it works under an App too. The four-state resolution removes the silent-green path that produced the issue, and the base-vs-PR comparison survives intact because `actions/runs` carries per-run `name`, `conclusion` and `head_sha`.

**What is lost, and it is not uniformly safe.** `actions/runs` returns **GitHub Actions runs only**. A third-party check run — a CI provider, a coverage or security service — posts a *check run*, not an Actions run, and is invisible. The consequence splits, and an earlier draft of this ADR got it wrong by calling the whole thing "the safe failure direction":

- **Actions-only repository.** A commit with no Actions runs resolves `unknown` and the Closer refuses to merge blind. Safe.
- **Mixed repository (Actions plus a third-party check service).** `total_count > 0` from the Actions side, so the read resolves from Actions alone and **a red third-party check is never seen**. The Closer merges over a failure it could not observe. That is an unseen failure, not a safe direction, and this decision does not protect against it.

A consumer in the mixed case has two honest options: run its loops under a GitHub App, where the Checks API is reachable and this decision should be revisited, or accept the gap knowingly. What this ADR must not do — and what its first draft did — is imply a safety that the read path does not have.

**What would reverse this.** Two things, either of which is sufficient: GitHub making `checks` grantable to fine-grained tokens, or a consumer whose loops all run under a GitHub App and who needs third-party check runs honoured. In the second case the Checks API is the better read and this decision should be revisited — the shape to prefer is a declared read path per access model, not a silent branch on which token happens to be present.

## Evidence for the App case — derived, not measured

The container this work was done in holds a fine-grained token and has no access to a GitHub App, so **no measurement under an App was taken, and none is claimed.** The App case rests on two checkable facts and one stated residual.

**Fact 1 — GitHub itself names the requirement.** `actions/runs` answers with `X-Accepted-Github-Permissions: actions=read`, measured above. The requirement is the API's own, not an inference about it.

**Fact 2 — both halves of the argument are cited, each to the page that enumerates its access model.** Both pages were fetched and checked, not merely linked:

| Claim | Page | What it shows |
|---|---|---|
| `actions` is grantable to a **GitHub App** | <https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps> | carries a section *"Repository permissions for 'Actions'"* |
| `checks` is **not** grantable to a **fine-grained token** | <https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens> | enumerates *"Actions"* and *"Commit statuses"* and **does not enumerate "Checks" at all** |

The second citation is the half that was previously unsupported. It matters more than the first: "the endpoint is unreachable" is the premise this whole decision rests on, and it had been asserted from an error message alone.

**The residual, stated rather than glossed.** A matching permission **name** does not prove an identical response **shape** under an App — the same endpoint may return fields a token's response omits, and nothing here has verified otherwise. An App additionally carries installation-level repository selection that a token does not, so "the permission exists" and "this installation can read this repository" are two different questions. Neither gap is expected to affect the fields this rule reads (`name`, `status`, `conclusion`, `head_sha`), and neither has been measured.

So the claim "this path also works under an App" is an inference from GitHub's own declared requirements, bounded by that residual, and it is labelled as such here, in the issue thread and in the pull request. Anyone able to run the read under an App should confirm it and replace this section with the measurement.

## Version

This changes documented runtime behaviour of a shipped skill, which `version_policy` classes as a **minor** bump: a new read path, a new four-state resolution and a new collapse rule are behaviour the loop's runtime depends on. `patch` covers what the runtime does not depend on and does not fit. The number itself lives only in `.claude-plugin/plugin.json`, per the single-source rule.
