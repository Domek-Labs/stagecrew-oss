# ADR 0015 — a structural check layer, and the executable code it puts into a Markdown-only repo

**Status:** accepted
**Date:** 2026-09-02
**Issue:** #80
**Amends:** `AGENTS.md` — the `syntax_check` field stops being the declared no-op `"true"` and names the layer's entrypoint; `default_oos` is overridden for #80 only (see "The Markdown-only override"). Adds `.github/`, `checks/` and `CONTRIBUTING.md`, none of which existed. Supersedes nothing.

## Context

This repo is Markdown only. There is no unit-testable surface, so the instinct is to reach for behavioural evals — and that is the wrong place to start, because **most regressions in a Markdown-only tool are structural, not behavioural.** A skill names an `AGENTS.md` field that no longer exists in the template. A `references/` pointer survives a file move. The README stops listing a skill that shipped.

#106 was exactly that: `skills/` held six skills and `README.md` listed five, so `/plan-issues` was invisible in the shop window from the day it shipped until somebody noticed by eye. #99 was the same class one layer down — six of seven `SKILL.md` files violated a frontmatter hard gate the repo applies to every PR, and nothing caught it. Neither needs a model to detect. Both silently degrade every loop that runs afterwards.

The repo had, at that point, **zero mechanical enforcement of any of its own written rules.**

## Decision

**Ship a structural check layer: five checks plus a runner, in `checks/`, written in Node with zero dependencies, invoked from exactly two sites that both run the identical entrypoint.**

### 1. The Markdown-only override, its scope, and what would reverse it

`AGENTS.md` `default_oos` carries **"No code generation (this repo is Markdown-only)"**. This layer is executable code, so it needs that rule waived. The repo owner granted the waiver on 2026-09-02, for #80 only, via the issue's `## Standards Override` block.

**The rule's purpose survives the waiver.** It exists so the *product* of this repo stays Markdown — skills, not software. `checks/` is not product: it ships inside the plugin package but nothing in the loop calls it, no consuming repo runs it, and deleting it would change no skill's behaviour by a character. It is tooling that guards the product.

That distinction is the whole of the waiver, and it is also its boundary. **What would reverse this decision:** the moment a check needs a dependency, a build step, an API key, or a runtime that is not already a hard requirement, it has stopped being repo-local tooling and become software this repo has to maintain. At that point the honest move is to delete the layer, not to add a `package.json`. Node is exempt from that test for one reason only — Claude Code itself runs on Node, so the runtime is already mandatory for anyone who can use this plugin at all.

The alternative that was weighed and rejected: **hosting the checks in a consuming repo.** It keeps this repo pure at the cost of the thing the checks exist for — they would drift away from the tree they check, and nobody would notice, which is the failure mode the layer is built to end.

### 2. Runtime: Node, zero dependencies, no manifest

No `package.json`, no `node_modules`, no lockfile. Measured in the working container: `node v22.23.2` and `jq` present; **no `python3`**, no `yq`. Node is the only runtime this plugin's users are guaranteed to have.

The visible cost is a hand-rolled YAML-subset parser in `checks/lib/yaml.js` rather than `js-yaml`. That cost is accepted deliberately, and the size of it has to be stated honestly: the parser covers block mappings nested at exactly two spaces per level, block sequences of scalars indented under their key, flow sequences of scalars, plain / single-quoted / double-quoted scalars, literal (`|`) and folded (`>`) block scalars, comments and blank lines. **That is the whole of what `AGENTS.md` and the `SKILL.md` frontmatters use today** — not the whole of what valid YAML, or the skill loader, allows. Four legal constructs sit outside it, each verified against the parser: a block sequence at the parent key’s own column, a mapping nested at four spaces, a sequence of mappings, and a multi-line plain scalar. The subset is documented in `CONTRIBUTING.md`.

**The parser is not extended to close that gap, and check 5 says so instead.** None of the four forms occurs anywhere in this tree, so the gap is latent, not live; extending `parseBlock` would add parser surface whose only proof is a layer that was already green, in a repo whose rule for this exact situation is that a check which outgrows the parser is too clever. What *was* wrong is what the check told the reader: it reported “frontmatter is not well-formed YAML”, accusing valid input of being malformed. The finding now names the parser’s subset as the limit, points at the file and line, and says in as many words that the line may be valid YAML the loader accepts. If one of those forms ever appears in a real `SKILL.md`, that finding is the prompt to extend the parser — with the counter-proof that comes with it — rather than to guess.

### 3. Two invocation sites, one entrypoint

`AGENTS.md` `syntax_check` and `.github/workflows/structural-checks.yml` both run **`node checks/run.js`** and nothing else.

They are complementary, not redundant. `syntax_check` runs **inside** the loop, so the Tester's result reaches the Critic before it votes. The workflow runs **outside** it — a `[stage:tester]` result is written by the stage about itself, while an Actions result is produced by GitHub — and it covers every push no loop touches: a hand edit, a `--refine` push, a hotfix branch.

**Neither site carries check logic**, and that is load-bearing under hard gate 8. The runner discovers its checks from disk (`checks/check-*.js`), so adding a check edits neither `AGENTS.md` nor the workflow, and the two sites cannot drift apart about what "the checks" means. A workflow that enumerated checks, thresholds or globs would be a second copy of the layer's definition and would go stale the first time a check was added.

**CI here is advisory, not enforcing.** This repo is private, and branch protection on a private repo requires GitHub Pro, so a *required* status check is unavailable. The workflow buys independent verification and coverage of non-loop pushes; it does not buy enforcement. That is stated in `CLAUDE.md` so no later reader assumes a gate that is not there. Making it enforcing is an account decision, not a code change.

### 4. Every check derives its expectation; none carries a copy of the rule

This is the sharpest constraint on the layer, and it comes from hard gate 8. A check that hardcodes a field list, a token list or a required-frontmatter list **is** a second copy of the rule, and it will drift away from the canonical one exactly as prose does.

| Check | Derives its expectation from |
|---|---|
| 1 | the field-completeness enumeration in `skills/work-issue/SKILL.md` — read and parsed at run time, including its declared count |
| 2 | the filesystem |
| 4 | the `skills/` directory |
| 5 | the Claude Code skill loader's frontmatter requirement (external reality — see below) |
| 6 | `version_policy` in `AGENTS.md`, which names both the manifest and the scheme; and that manifest, which supplies the version string |

The one that needs an argument is **check 5**. Deriving its field list by parsing the English hard-gate sentence would itself be a copy under that gate's own drift test — reword the sentence and the parser breaks. Instead the check asserts what the **loader** requires to load a skill at all: well-formed frontmatter carrying `name` and `description`. That is a fact about an external runtime, not about this repo's prose. The gate and the check agree because both describe the same reality, and neither is derived from the other; reword the gate and the check stays correct. That is the drift test passing rather than being argued around.

**File paths are addressing, not copying.** Every check names the files it reads — it must, or it could read nothing. What it may not carry is the *expectation*: rename a field in the canonical enumeration and check 1 changes what it requires with no edit here; move a `references/` file and check 2 follows the disk; bump the version and check 6 searches for the new string.

### 5. The numbering keeps a gap at 3

There is no check 3, and there is no check 3 **on purpose**. It was specified as "every stage name and verdict token is spelled identically everywhere it appears", and there is **no canonical enumeration of stage names or verdict tokens anywhere in this tree** — the tokens appear only as scattered inline alternatives (`<GO|STOP>`, `<PASS|FAIL>`, and a `## [stage:critic] <verdict>` line that enumerates nothing). A check with no canonical source must hardcode its list, which §4 forbids. Building it now would mean inventing the authority it is supposed to read.

**#42 §1 already owns creating that table** — one table of verdict × next step × claim released? × worktree removed? × tracker `status`. Once it has landed, check 3 becomes a follow-up that reads it. The gap in the numbering is how the deferred check keeps its identity until then; do not renumber checks 4, 5 and 6 to close it.

### 6. Check 6's version rule, narrowed — and what it deliberately does not reach

The rule as first specified was a **shape** rule: flag `v?\d+\.\d+\.\d+` anywhere outside the manifest. Dry-run on a clean tree: **nine findings, zero defects.** Two classes of false positive, both structural rather than accidental:

- **a semver threshold in the version policy's own prose** — `1.0.0` four times in `AGENTS.md` `version_policy` and twice in `docs/adr/0004`. These are policy *targets*, not claims about the current version. Note the irony: `AGENTS.md` is the canonical home of the rule check 6 enforces, and the shape rule flagged it hardest.
- **a third-party tool version in a historical record** — `gitleaks 8.16.0` twice in `docs/audit/git-history-secret-sweep-2026-06-28.md`. Not this plugin's version at all.

**The narrowed rule: flag any occurrence, outside the manifest, of the version string the manifest currently carries** — read from the canonical source at run time rather than carried as a regex. This is both quieter and *stronger* under §4: the check consults the source instead of copying a shape. Neither false-positive class survives it, because neither names the current version.

**Its deliberate blind spot: a reference to a stale version.** "v0.29.0 introduced X" is a sentence this check will never flag. Separating a historical statement from a live claim needs judgement, and judgement is precisely the line this layer does not cross — the moment it starts guessing intent it stops being a structural check and becomes a small, unreliable reviewer. That gap is real and is accepted.

One boundary detail, recorded because it was found by counter-proof rather than by reading: the version must stand alone, so it is not matched inside a longer version string, but a **sentence-final** occurrence *is* matched. The trailing full stop is punctuation; the sentence is still a claim about the current version.

### 7. Check 2's resolution rule

A `references/...` mention resolves **relative to the directory of the `SKILL.md` that mentions it**; failing that, it is looked up under every `skills/*/references/`. Only a path that resolves nowhere is a finding.

Without the fallback the check is red on a clean tree: `skills/init-agents/SKILL.md` points at `references/repo-registry.yaml.example`, whose file lives under `skills/work-issue/references/` and whose parenthetical `(work-issue)` disambiguates it for a human but not for a naive path join. The file exists; that was a false positive, not a dead pointer. Cross-skill pointers are an intended pattern here, so the check accommodates them rather than fighting the repo.

A mention carrying a `<placeholder>` (`references/issue-templates/<type>.md`) is a path *template*, not a path. For those the check asserts the containing directory exists — the strongest claim available without expanding the placeholder.

### 8. `models:` in the template: the check means "declared", not "parsed"

`skills/init-agents/references/AGENTS.md.template` carries `models:` **only as a comment**. So "the field is present in the template" is true by `grep` and false by YAML parse, and check 1 had to state which it means.

**Decision: a field appears when a line declares it as a key, live or commented out.** This is not a convenience. Hard gate 8 in `AGENTS.md` enumerates "the commented `models:` values" as one of exactly four *deliberate* copy artifacts in that template — the repo's own canonical rule says the commented block is the intended shape, because a template is read standalone by a human in a foreign repo where no pointer resolves back into this plugin. A check demanding a live YAML key would therefore contradict the rule it is meant to serve, and would go red on a tree that is correct.

The cost is that check 1 cannot tell a commented example from a live default. That is the right trade here: the drift it exists to catch is a field **renamed or dropped entirely**, and a rename leaves the comment behind as an equally stale token, which the check still catches.

### 9. Version bump class: `patch`

`version_policy.minor` enumerates: new skill, new loop-type, new subagent-brief, new `AGENTS.md` field, changed skill behaviour, new required frontmatter field. **This change adds none of them.** `checks/` ships no skill, the workflow ships no skill, and `syntax_check` gains a *value* — the key already existed, carrying the declared no-op `"true"`. `version_policy.patch` reads "everything the plugin's runtime behavior does NOT depend on", which is exactly what repo-local tooling is. No consuming repo's loop behaves differently because this landed.

## Consequences

**The layer must stay green, and that is the point.** The entrypoint exits non-zero on any finding, because a check layer that finds a defect and exits 0 is not a check layer. Consequently `syntax_check` is now a real gate inside every loop in this repo: a red layer STOPs the Tester. The rule for a finding is fixed — a real defect is fixed in the PR that surfaced it, a false positive means the check is wrong and the check is corrected, and a finding whose fix exceeds the current issue's scope is reported rather than absorbed. Widening an issue to force green is the one move that is never available.

**It found something on its first run.** Check 6 flagged a version string inside check 6's own comments — written while explaining the boundary rule. Fixed in the same PR, and worth recording: the layer's first real finding was against the layer.

**CI wakes a code path that has never fired.** `dev` had zero check runs before this. `CLAUDE.md` states that when the base has no check runs to compare against, every red check blocks (fail safe), so this PR's own workflow run has to be green. Related: **#16** ("Closer can end silently while waiting for CI") becomes reachable the moment CI exists; `CLAUDE.md` already describes the fixed behaviour, so #16 is plausibly resolved-in-spec and merely unclosed.

**What the layer does not reach, stated so the gap is not mistaken for coverage.** It catches structural drift only. It does not read prose for meaning, so a semantic contradiction between two documents — #61's class, where `README.md` and `CLAUDE.md` describe the claim protocol in terms the canonical `skills/work-issue/SKILL.md` contradicts — is invisible to all five checks. That class is owned elsewhere and deliberately: the Critic's standing out-of-diff falsification check (`docs/adr/0011`) searches for exactly it. #61 predates that mechanism, which is why it survived; #80 does not try to reach it. **And that mechanism has its own blind spot, found here:** it excludes hits by the *path* they were found in, so it structurally cannot see a statement the diff falsified inside a file the diff itself touches — `AGENTS.md` said "the repo is Markdown-only" in the same file as the `syntax_check` line that made it false, was excluded as an in-diff path, and was caught only by a reviewer reading the file.

**No behavioural coverage is bought here.** Golden cases and any model-graded judgement are #81, and they come last because they cost a model run each. The moment this layer needs an API key it has stopped being this layer.

**Adding a check is a three-line contract**, documented in `CONTRIBUTING.md`: drop a `checks/check-<n>-<slug>.js` file that exports a check object naming its canonical source. Nothing else changes — not the runner, not `AGENTS.md`, not the workflow.
