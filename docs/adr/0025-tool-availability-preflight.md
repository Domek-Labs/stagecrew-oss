# ADR 0025 — the pre-flight probes the tools the shipped skills actually invoke, and the AGENTS.md YAML check drops its `python3` dependency

**Status:** accepted
**Date:** 2026-09-16
**Issue:** #113

> **Snapshot.** Decision 6's restatement of the substitution rule is the wording as decided on
> this date. Its canonical home is `skills/work-issue/SKILL.md`, "Tool availability pre-flight";
> if that text moves on, this record stays as written — it documents the decision, not the
> current text, and is therefore not a hard-gate-8 copy.

## Context

The shipped skills instruct a stage to run specific external commands — most visibly
`python3 -c "import yaml; yaml.safe_load(...)"` for the AGENTS.md YAML-parseability check
(`skills/work-issue/SKILL.md`, `skills/init-agents/SKILL.md`) — without ever declaring that the
command is required or checking that it exists. Measured on this container on 2026-09-16:
`python3` and `yq` are both absent (`which python3` / `which yq` → exit 1); `node`, `jq` and `gh`
are present; `grep` is present but, in the shell a `/work-issue` stage actually runs its bash
commands in, resolves to a harness-injected shell function that shims to an ugrep-compatible
mode (confirmed via `type -a grep` / `declare -f grep`) rather than the real system `grep` (GNU
grep 3.8, reachable via `command grep` or a non-interactive shell).

This is not hypothetical. Issue #106 already hit it: a sweep pattern shaped
`[^.]{0,40}` under ugrep's default leftmost-longest, non-backtracking engine silently missed the
two defect lines the loop was searching for, while the same recursive sweep still matched other
lines — so the command exited clean and *looked* like a complete sweep. This issue's own
reproduction (documented in `skills/work-issue/references/tool-requirements.md`, "The ugrep
gotcha") found a second, distinct construct with the same failure mode: `\b(four)(th)?\b` — an
optional group immediately before a word-boundary assertion — matches under a PCRE2 engine
(`grep -P`) and matches nothing at all under this container's default `grep`.

The pattern (per #113's own framing, echoing #80 and #111): a skill that names a tool it never
checks for has three possible outcomes when that tool is missing or behaves differently — the
stage errors loudly (best), the stage substitutes something and says so (acceptable), or the
stage substitutes something silently (what actually happens, because a capable agent works
around a missing tool without being asked). The third is indistinguishable from a passing check,
and #106 shows it already produced a wrong result once.

## Decision

**1. Declare the tool list in one canonical file, derived by search.** `skills/work-issue/
references/tool-requirements.md` is the single canonical home (AGENTS.md hard-gate 8) for: the
search that derived the list (shown, not asserted), each tool's status (`required` /
`preferred-and-degradable` / "not a dependency" for `jq`, which turned out to be `gh`'s own
embedded evaluator rather than a real dependency), the consequence of absence, and — for the
tools with a fallback — the fallback itself.

**2. Probe the list in `/work-issue`'s pre-flight, immediately before the AGENTS.md mandatory
check.** The probe's posture is copied deliberately from two mechanisms this repo already has,
rather than invented fresh: the code-graph MCP's graceful degradation (optional, opportunistic,
never blocks) and the `strategy.gates` consistency report's print-nothing-when-clean rule (a
report that states its own silence trains the reader to skip it). Concretely: a report, never a
STOP, printed once before stage 1, silent when nothing is missing or degraded.

**3. One named exception: a tool a mandatory pre-flight step itself depends on, with no rung
left, STOPs.** A report implies the run continues; nothing can make a *mandatory* check pass with
zero working implementations behind it. Today this applies only to the YAML-parseability check's
final rung (`grep`/`sed`) if it is unavailable *alongside* `python3` and `node` — every other
named tool either has a fallback or is assumed-present foundational infrastructure (`git`, `gh`)
that the loop could not have reached its pre-flight without in the first place.

**4. The YAML-parseability check becomes a three-rung fallback chain, not a single hard-coded
call.** `python3` (full PyYAML coverage) → `node` running this repo's own zero-dependency
YAML-subset parser (`checks/lib/yaml.js`'s `parseFrontmatter()`, built for the structural check
layer, ADR 0015) → a `grep`/`sed` structural scan (fence presence + field-name presence only).
Rungs 1–2's coverage is *tested*, not asserted — including a correction the round-1 Critic review
caught: an earlier draft of this change claimed rung 2 would "misreport as broken" a handful of
YAML constructs outside its subset, which is true for exactly one of them (a mapping nested at
other than two spaces — a genuine false STOP, tested and confirmed) and false for the rest
(anchors/aliases, a flow mapping, a second `---` block all parse **without** error and return a
silently wrong value — the opposite failure). Rung 2 correctly rejects an unterminated quote with
a line number; rung 3 does not — the same broken file passes rung 3's fence-and-field-name check,
because rung 3 never parses YAML at all. Rung 3's own guard is likewise tested rather than
asserted, and the same round-2 Critic review caught a second overclaim in the same sentence: an
earlier draft claimed an unguarded rung 3 would produce a silent false "field not found" verdict
under `grep` absence; tested under a genuinely `grep`-free `PATH`, it instead dies at the fences
check with a misleading message ("fewer than two frontmatter fences ()") before the field loop is
ever reached — still a real defect the guard fixes, just not the one first claimed. A third,
sharper correction landed in round 4: rung 2's `require()` of the parser was rooted at
`<repo_path>` — the target repo's checkout — through rounds 1–3, which meant it could never load
outside this repo at all (`MODULE_NOT_FOUND`, uncaught, on every consuming repo), since
`checks/lib/yaml.js` is plugin-internal and no consuming repo has it. Fixed by resolving it
skill-relative from `skills/work-issue/` instead, the same convention `{{git_conventions}}`
already uses, and by catching the load failure separately from a YAML parse error so a caller can
tell the two apart (`RUNG2_UNAVAILABLE`, exit 2, degrades to rung 3 — vs. a real syntax error's
exit 1). Demonstrated against a throwaway directory containing only a copy of this repo's
`AGENTS.md`, standing in for an arbitrary consuming repo. All three gaps are stated in the
canonical file (pointing at `CONTRIBUTING.md` for the parser's general limits, stating only the
rung-specific STOP/silent-pass consequence locally) rather than hidden or overclaimed, per the
issue's explicit "each rung's coverage stated" requirement.

**5. Every `grep` pattern already shipped is re-verified, not rewritten.** All real pattern
invocations found by the search (canonical table: `skills/work-issue/references/
tool-requirements.md`, "Verification" — cited there by section name rather than line number,
since a line number in a file this diff edits is already stale by the time it is committed, which
happened to this ADR's own first draft) already use
`-F` (fixed-string), an anchored literal with no quantifiers, or a character class with only
*unbounded* trailing quantifiers and no optional group adjacent to a `\b` — none of the shapes
that broke in #106 or in this issue's own reproduction. Re-testing each one against this
container's default `grep` confirmed all four still match correctly. No pattern needed a
rewrite; the issue's own preference ("a pattern that works everywhere beats a documented
assumption nobody re-reads") is satisfied by verification, and the verification itself — not a
promise — is what is recorded.

**6. Substitution is never silent, stated once, for every stage.** Not just the pre-flight: any
stage that substitutes a tool or narrows a check because something is absent states it in its
own stage comment, the same posture `docs_command` already follows by distinguishing a
declared-empty command from an absent field. Stated once in `skills/work-issue/SKILL.md`'s new
"Tool availability pre-flight" section; not repeated per stage.

## Why installation is out of scope, and what would reverse that

**Out of scope, deliberately.** This plugin is a pure reader (`AGENTS.md`, "Non-goals": "Not a
standards library"): what a stage must obey comes from the target repo, never from the plugin
itself, and the plugin ships no dependency manifest of any kind. Extending that posture to "the
plugin also provisions its own runtime" would make it responsible for a container it does not
own, cannot persist changes to across restarts in the operator's one-container-per-task execution
model — one container, one task, nothing survives the run except the PR — and cannot verify was
even installed correctly for the *next* invocation. A loop
that tries to `pip install pyyaml` and reports success has silently taken on exactly the
liability this issue exists to remove: a result nobody asked the loop to produce, running with
whatever privileges the loop happened to have.

**What would reverse this.** If a future harness gives `/work-issue` a documented, idempotent way
to request a runtime dependency from its *operator* (not install one itself) — e.g. a declared
`requires:` manifest the container step reads before the loop starts, analogous to how
`wallclock_cap_min` is a declared budget the loop reads rather than a number the loop invents —
that would be a new, narrow mechanism worth its own ADR. It would not resemble "the loop runs
`pip install`" under any framing considered here: the operator, not the loop, would still be the
one deciding what lands in the container.

## Alternatives considered

- **Vendor a YAML parser into the plugin.** Rejected: the plugin ships no dependencies by
  design (ADR 0015's Markdown-only / zero-dependency stance), and `checks/lib/yaml.js` already
  exists for exactly this purpose — reusing it costs nothing new.
- **Require `python3` and STOP when it's absent.** Rejected: this is the status quo the issue is
  about. `python3` is not load-bearing for anything the loop's own mechanism needs beyond one
  YAML parse; a full STOP over a tool with a working fallback would make an entire class of
  otherwise-healthy containers unable to run the loop at all.
- **Rewrite every shipped `grep` pattern to `grep -P` unconditionally.** Rejected: none of the
  shipped patterns need it (see Decision 5), and forcing `-P` everywhere would be a
  correctness-motivated change with no correctness gap behind it — the kind of unforced
  complexity the repo's own conventions argue against elsewhere (e.g. ADR 0019's deletability
  test).
- **Make the tool-availability report unconditional (always print, like the time-budget line).**
  Rejected: the issue's own AC requires silence when everything is present, matching the
  `strategy.gates` report's rule rather than the time-budget line's — the two existing
  precedents disagree on purpose (a budget is never "a problem," a missing tool is), and this
  probe is a problem-report.

## Version

A new pre-flight step is changed skill behaviour that stays backwards-compatible for every
existing AGENTS.md (no new field, no new required setup, purely additive reporting), which
`version_policy` classes as **minor** under 0.x. `patch` is reserved for changes the runtime does
not depend on; this one changes what the pre-flight does on every run. The number itself lives
only in `.claude-plugin/plugin.json`, per the single-source rule.
