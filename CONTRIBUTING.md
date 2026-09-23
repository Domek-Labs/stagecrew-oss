# Contributing to stagecrew

## From outside

stagecrew is developed in a private repository; this public repo receives one squashed commit per release (why: `docs/adr/0027-public-release-mirror.md`).

- **Bugs and proposals:** open an issue here, using one of the templates. Issues are read by hand and carried into the development repo when accepted; the issue here gets a note when that happens. Answers can take a few days.
- **Pull requests:** welcome, but they cannot be merged directly — there is no shared history between the two repos. An accepted change is re-applied in the development repo, credited to you (`Co-authored-by`), and arrives here with the next release; the PR is then closed with a pointer to that release. Open an issue first for anything larger than a fix.
- **Security issues:** see [SECURITY.md](SECURITY.md) — not a public issue.

The rest of this file describes how the repo works on the inside.

## How the repo evolves

This repo evolves itself with its own loop: `/create-issue` writes the spec, `/work-issue` drives it through Validator → Implementer → Tester → Critic → Closer. The standards every stage obeys are in `AGENTS.md`, which is the single source of truth for them and is not restated here.

This file covers one thing `AGENTS.md` does not: **the structural check layer** — how to run it, how to add a check, and what each existing check derives from.

## The structural check layer

This repo is Markdown only, so there is nothing to unit-test. What there *is* to verify is that the repo's own structure still holds together: that a skill still points at files that exist, that the README still names every skill that ships, that a field the loop requires is still in the template it writes. The layer catches that class, in well under a second, with no model and no network.

Design rationale, and the reasoning behind every judgement call in it: `docs/adr/0015-structural-check-layer.md`.

### Running it

```bash
node checks/run.js          # the whole layer — this is the entrypoint
```

Exit codes are the same for the layer and for any single check:

| Code | Meaning |
|---|---|
| `0` | no findings |
| `1` | at least one finding |
| `2` | a check itself broke (a bug in the layer, not a finding about the repo) |

Every check is also runnable on its own, which is how you iterate on one:

```bash
node checks/check-4-readme-skill-inventory.js
```

There is nothing to install. No `package.json`, no `node_modules`, no lockfile — deliberately, and permanently. If a check appears to need a library, the check is too clever; simplify the check.

### Where it runs

Two sites, both running **`node checks/run.js`** and nothing else:

- **`AGENTS.md` `syntax_check`** — inside the loop, so the Tester's result reaches the Critic before it votes. A red layer STOPs the loop.
- **`.github/workflows/structural-checks.yml`** — outside the loop, on every push and pull request, including the ones no loop touches (a hand edit, a `--refine` push, a hotfix branch).

**CI here is advisory, not enforcing.** The development repo is private, so a required status check is unavailable there. Read a red mark; nothing forces you to.

Neither site carries any check logic — no check list, no thresholds, no globs. The runner discovers `checks/check-*.js` from disk, so both sites stay correct however the layer changes.

### What each check derives from

The rule the layer lives by: **a check derives its expectation from the canonical source; it never carries its own copy of the rule.** A check that hardcoded a field list or a version regex would be a second copy under `AGENTS.md` hard gate 8, and it would drift exactly as prose does.

| # | Check | Canonical source it reads |
|---|---|---|
| 1 | every canonical `work-issue:` field appears in the AGENTS.md template | the field-completeness enumeration in `skills/work-issue/SKILL.md`, parsed at run time — the `/work-issue` pre-flight *executes* that list, which is what makes it the authority |
| 2 | every `references/...` path a `SKILL.md` mentions exists | the filesystem |
| 4 | `README.md` lists every skill that ships | the `skills/` directory |
| 5 | every `SKILL.md` has well-formed frontmatter with `name` and `description` | the Claude Code skill loader's requirement — external reality, not this repo's prose |
| 6 | the version manifest is consistent, and no other file names the current version | `version_policy` in `AGENTS.md` (which names the manifest and the scheme) and the manifest itself (which supplies the version string) |
| 7 | the tree carries none of the private-path / credential-shaped patterns declared for the public release mirror | `checks/release-denylist.json` — see `docs/adr/0027-public-release-mirror.md` for the denylist-exclusion decision and the false-positive proof. Tracked files only (`git ls-files`); `git add` a new file to have it scanned locally |

Each check also prints its canonical source in its own output, so a finding tells you where to look without opening this file.

**The gap at 3 is deliberate.** Check 3 — verdict-token consistency — is deferred to #42, which owns creating the canonical table it would have to read. Building it before that table exists would mean inventing the authority it is supposed to consult. Keep the gap; do not renumber the others.

### Adding a check

1. Drop a file at `checks/check-<n>-<slug>.js`. The runner discovers it by name — nothing else needs editing, not the runner, not `AGENTS.md`, not the workflow.
2. Export a check object built with `defineCheck` from `checks/lib/check.js`:

```js
const { defineCheck, finding, read, runAsCli } = require('./lib/check');

const check = defineCheck({
  id: 8,
  title: 'a one-line statement of what must hold',
  canonical: 'the file this check reads its expectation from',
  run() {
    // Return an array of findings; an empty array is a pass.
    // Never print, never exit — the runner owns both.
    return [finding('path/to/file.md', 42, 'what is wrong, in English')];
  },
});

module.exports = check;
if (require.main === module) runAsCli(check);
```

3. Four rules the check has to satisfy:
   - **Derive, do not copy.** Read the rule from its canonical file at run time. Naming the *path* of that file is addressing and is fine; carrying the *expectation* is a copy and is not.
   - **Report a file and a line**, not a boolean. A finding a reader cannot navigate to is barely a finding.
   - **Prove it can be red.** Break an input on purpose, watch that check fail while the others stay green, revert. A check that has never been red is not a check — ship the transcript in the PR.
   - **No dependencies, and stay fast.** The whole layer runs on every commit; nobody should have to think about its cost.

4. Helpers available in `checks/lib/`: `check.js` (repo-root-relative file access, skill enumeration, findings, the single-check CLI harness) and `yaml.js` (the YAML-subset parser).

### The YAML parser, and its limits

`checks/lib/yaml.js` is a small hand-rolled parser, because the layer takes no dependencies. It covers block mappings nested at **exactly two spaces** per level, block sequences of scalars indented under their key, flow sequences of scalars, plain / single-quoted / double-quoted scalars, literal (`|`) and folded (`>`) block scalars, comments and blank lines. That is the whole of what `AGENTS.md` and the `SKILL.md` frontmatters use **today** — it is not the whole of YAML, and it is not the whole of what the skill loader accepts.

Four legal constructs are outside the subset, each verified against the parser:

| Form | What the parser says |
|---|---|
| a block sequence at the parent key’s own column (`allowed-tools:` then `- Bash` at column 0) | `sequence item inside a mapping` |
| a mapping nested at four spaces | `unexpected indentation (expected 2 spaces, found 4)` |
| a sequence of mappings (`- k: v`) | `mapping inside a sequence item is outside the supported subset` |
| a multi-line plain scalar | `unexpected indentation (expected 0 spaces, found 2)` |

Anything outside the subset raises an error carrying a line number, which check 5 reports rather than swallowing. **Read that finding as “the parser stopped here”, not “this YAML is broken”** — the line may be perfectly valid YAML the loader would accept. If a check needs YAML the parser cannot read, do not extend the parser first: ask whether the check is reaching too far. If the answer is genuinely no, extend it and ship the counter-proof with the change.

That "raises an error" guarantee has three exceptions — constructs the parser accepts silently
and returns a **wrong value** for, rather than rejecting, verified against `checks/lib/yaml.js`
on 2026-09-16:

| Form | What the parser silently does |
|---|---|
| anchors and aliases (`&a` / `*a`) | reads them as plain scalars (`&a` and `*a` become literal text) rather than resolving or rejecting them |
| a flow mapping (`{a: 1}`) | reads the whole `{a: 1}` as a plain scalar **string**, not a parsed object |
| a second `---`-fenced block after the first | `frontmatterOf()` recognizes only one opening/closing fence pair by design (it is a frontmatter extractor, not a multi-document YAML reader) — everything after the closing fence is Markdown body, so a second block's values are never seen, silently |

Any caller that treats a `parseFrontmatter()` result as evidence that "the file contains no other
legal-YAML surprise" is wrong on these three — it only proves the four *rejected* forms above are
absent, not that nothing else is off.

### When the layer goes red

- **A real defect** → fix it in the PR that surfaced it. The repo has just agreed to gate on this; shipping a gate that is immediately waved through is worse than shipping no gate.
- **A false positive** → the check is wrong. Correct the check, and record the narrowed rule where the reasoning lives (an ADR, if the rule is a judgement call).
- **A fix that would exceed the current issue's scope** → stop and report it, naming the finding. Never widen an issue to force green.
