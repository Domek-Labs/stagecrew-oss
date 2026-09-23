# Tool requirements — canonical list, derivation, and the YAML-parseability fallback chain

**This file is the single canonical home** (AGENTS.md hard-gate 8) for three things `/work-issue`'s
pre-flight and two other skills otherwise had no one place to state: which external commands a
shipped skill's instructions actually invoke, which of those the loop can degrade around, and the
`python3` → `node` → structural-scan fallback chain the AGENTS.md YAML-parseability check now
runs instead of a single hard-coded `python3` call. Every other mention — `skills/work-issue/
SKILL.md`'s "Tool availability pre-flight" and "AGENTS.md mandatory check" §2, `skills/init-agents/
SKILL.md`'s "Refine workflow" §2, `CLAUDE.md`, `AGENTS.md`'s known-gotchas body — points here rather
than restating a table, a rung's coverage, or the ugrep failure text. Drift test (AGENTS.md hard-gate
8): any of those mentions would have to change if this file's table or rungs changed; none of them
carries a copy that could drift.

Background: [#113](https://github.com/Domek-Labs/stagecrew/issues/113), following the same failure
class as [#106](https://github.com/Domek-Labs/stagecrew/issues/106) (a `grep` pattern silently
under-reporting under ugrep) and [#111](https://github.com/Domek-Labs/stagecrew/issues/111) (a
fetch failure routed around and nearly booked as green).

## How this list was derived (search shown, not assembled from memory)

Every shipped `SKILL.md` and `references/*.md` was searched for command-shaped tokens, then each
hit was read in context to separate an actual invocation from a prose mention or an
example/illustrative command meant for a *target* repo's own configurable fields (`smoke_test`,
`deploy_command`, `syntax_check` — those are per-repo values a consuming repo supplies, not a tool
this plugin's own mechanism depends on, and auditing them is explicitly out of this issue's scope).

```
$ find skills -name "*.md"
skills/create-issue/SKILL.md
skills/create-issue/references/issue-templates/code.md
skills/create-issue/references/issue-templates/research.md
skills/create-issue/references/trigger-example.md
skills/github/SKILL.md
skills/init-agents/SKILL.md
skills/init-agents/references/components-registry-template.md
skills/init-agents/references/model-presets.md
skills/loop/SKILL.md
skills/plan-issues/SKILL.md
skills/work-issue/SKILL.md
skills/work-issue/references/subagent-briefs/code-implementer.md
skills/work-issue/references/subagent-briefs/research-implementer.md
skills/work-issue/references/subagent-briefs/visual-reviewer.md
skills/work-issue/references/tool-requirements.md
```

Fifteen files at HEAD — this file itself (`tool-requirements.md`) is the expected fifteenth
entry, self-referential for the same reason the `grep`-enumeration and `jq` searches below match
this file too.

```
$ grep -rn "python3" skills/ AGENTS.md CLAUDE.md CONTRIBUTING.md
skills/work-issue/SKILL.md:431:   python3 -c "import yaml; yaml.safe_load(open('<repo_path>/AGENTS.md').read().split('---')[1])"
skills/init-agents/SKILL.md:306:2. Parse the YAML frontmatter (`python3 -c "import yaml; print(yaml.safe_load(open('<path>').read().split('---')[1]))"`).
skills/github/SKILL.md:30:In a constrained container the local `.git` can be read-only (no `git push`), and tooling like `python3` may be missing.
```

**Line numbers above are the pre-change (`dev`) state** — this search found the two real
invocations before this diff removed them; they do not resolve at HEAD, since the fix replaced
both call sites with a pointer to "The YAML-parseability fallback chain" below. Kept as the
evidence that motivated the change, not as a live citation. `skills/github/SKILL.md:30` is prose
inside the transcluded `git_conventions` block, giving `python3` absence as *motivation* for the
read-only-`.git` → `gh` fallback rule; it names no invocation of its own, needed no change, and
is unaffected by the diff — that one line number still resolves at HEAD.

```
$ grep -rn "\byq\b" skills/ AGENTS.md CLAUDE.md CONTRIBUTING.md
skills/init-agents/SKILL.md:373:   yq -i '.["<owner>/<repo>"].agents_md_exists = true' ~/.claude/work-issue-paths.yaml
skills/init-agents/SKILL.md:374:   # Fallback without yq:
```

Two lines, not three — `\byq\b` needs a literal `yq`, and the next line (`# sed edit or Python
update on the same live file`) contains none. At HEAD, re-running this exact command also matches
this file's own quotation of the two lines above, self-referential for the same reason the
`grep`-enumeration and `find` searches elsewhere in this section match `tool-requirements.md`
itself; not a second real hit. `yq` already ships with a documented fallback (`/init-agents`,
"Repo-registry update"). This issue does not change that step; it is listed here because the list
has to be derived by search, not invented, and `yq` is a real hit.

```
$ grep -rln "grep" skills/
skills/work-issue/references/subagent-briefs/code-implementer.md
skills/work-issue/references/tool-requirements.md
skills/work-issue/references/subagent-briefs/research-implementer.md
skills/work-issue/SKILL.md
skills/create-issue/references/trigger-example.md
skills/create-issue/SKILL.md
```

(`tool-requirements.md` is this file itself — self-referential and expected, since this section's
own prose names `grep`.) **A prior version of this file showed a 4-glob form here
(`skills/*/SKILL.md skills/*/references/*.md skills/*/references/**/*.md`) with a 3-file result
that does not reproduce** — re-running that exact command now returns the same six files as the
recursive form above. No reliable account of the original 3-file output survives; rather than
guess at a mechanism, this file now uses the plain recursive form (`-r` given an actual directory)
and the pasted output above is real, re-run at commit time. Re-run it the same way whenever this
list is next checked.

Read in context, the real invocations (as opposed to the word "grep" used in prose) are:

```
skills/work-issue/SKILL.md, "Pre-Flight stage 0" (Live-path drift check step)
  diff -r <live_path> <repo_path>
skills/work-issue/SKILL.md, "Stage 2 — Implementer (type dispatch)" (Default secret_scan_pattern)
  secret_scan_pattern, used as grep -iE '<pattern>' for the Implementer's pre-commit secret scan
skills/work-issue/references/subagent-briefs/code-implementer.md (pre-commit secret scan step)
  git diff --cached | grep -iE '{{secret_scan_pattern}}'
skills/work-issue/references/subagent-briefs/research-implementer.md (pre-commit secret scan step)
  git diff --cached | grep -iE '{{secret_scan_pattern}}'
skills/work-issue/SKILL.md, "Out-of-diff falsification check", "§2 — Search for descriptions ..."
  grep -rn -F -f <tmp>/ood-terms-<repo>-<issue> . --include='*.md' | awk ...
  grep -v -F -f <tmp>/ood-paths-<repo>-<issue>          (named in prose, same step)
skills/work-issue/SKILL.md, "Squash-merge identity check (report, never a gate)"
  gh pr view <pr> --json commits --jq '.commits[].authors[].email' | sort -u
  git log -1 --format=%B <merge-sha> | grep -c '^Co-authored-by:'
skills/work-issue/SKILL.md, "Stage 5 — Closer (type routing)" (Drift check before stack rebuild)
  diff -r <live_path> <repo_path>
skills/create-issue/SKILL.md, "Issue-type detection", trigger 3 (secret-handling reminder)
  the pattern [A-Z_]+_(KEY|TOKEN|SECRET|PAT) — a create-issue trigger condition evaluated by the
  agent reading the drafted issue text, not necessarily shelled to `grep`; included for
  completeness
skills/create-issue/SKILL.md, "Issue-type detection", trigger 1 (docs-scope reminder)
  "ADR-schema grep" — a suggested AC for a *target* repo's own docs check, not an invocation this
  plugin's own mechanism runs; excluded
```

Citations above are section/step names rather than line numbers deliberately — a line number in
a file this diff itself edits goes stale the moment it is committed (see "Fix the stale line
citations" discipline this file now follows throughout). `create-issue/references/
trigger-example.md` (the line naming "secret scan ... greps for token pattern") is prose, not a
separate invocation — it describes the same secret-scan step named above.

```
$ grep -rn "| *jq\|^jq \| jq " skills/ AGENTS.md CLAUDE.md CONTRIBUTING.md | grep -v -- '--jq'
skills/work-issue/SKILL.md:327:   The jq emits **every** matching PR; if more than one is open, name them all. If at least one exists, the issue's implementation work is already done and stages 1–2 never run again — the run **resumes the merge** for that PR instead of re-working the issue, but only for a PR a completed loop produced. (One named exception re-runs stages 3–4 to regenerate execution evidence without touching the implementation — see "the evidence-gate re-entry" below.) An open PR is not by itself evidence that the work passed review, and the resume ends in a squash-merge, an issue close and an unattended deploy with no automatic revert. It must therefore clear a bar. Read the issue thread (`gh issue view <n> --json comments`) and require **both**:
```

The one real hit is prose — "The jq emits **every** matching PR" refers back to the `gh pr list
... --jq '...'` expression two lines above it in the same step; it names no standalone invocation
of its own, the same disposition as every other prose exclusion in this file (`skills/github/
SKILL.md:30`, `find`/`head` below). (Re-running this exact command **after** this file exists also
matches this file's own quotation of that line, twice — self-referential for the same reason the
`grep`-enumeration search below matches `tool-requirements.md` itself; not a second real hit.)
With that one hit disposed of, no shipped skill pipes to a
standalone `jq` binary — every `jq`-shaped instruction is `gh ... --jq <expr>`. Verified
in-container that this really is `gh`'s own embedded evaluator and not a call to the system `jq`
binary: with a failing decoy `jq` placed *ahead* of the real one on `PATH`, `gh api
repos/Domek-Labs/stagecrew --jq .default_branch` still returned `dev` without the decoy ever
running. `jq` is therefore **not a runtime dependency of any shipped skill** and is not part of
the probed list below.

`find`, `head` also matched the bare words in this search but both hits were prose (`"...lets the
standard cleanup rule below **find** it..."`, `"No base / **head** / revert_check keys..."`, the
latter naming a YAML *key* called `head`, not the coreutil) — neither is an invocation.

## The list

**Probed** is the literal answer to "does the tool-availability pre-flight run `command -v` on
this row" — it is the whole of the probe set (see "Probing" below), so a future stage reads the
set off this column rather than inferring it from the Status column or from prose. `git` and `gh`
are `required` but **not** Probed: they are the infrastructure the pre-flight itself runs on, so
their absence is not a question this probe can even pose — see "Probing" for why that is
principled rather than an oversight.

| Tool | Status | Probed | Where a shipped skill invokes it | Consequence of absence |
|---|---|---|---|---|
| `git` | required | no | every stage: worktree, commit, push, diff, log | the loop cannot do anything; the pre-flight itself could not have started without it |
| `gh` | required | no | claim protocol, issue/PR/label/comment ops, `gh api ... --jq` reads throughout | same as `git` — the claim protocol (`skills/work-issue/SKILL.md`, "Pre-Flight stage 0", step 2) cannot run without it |
| `grep` (or an equivalent text-search primitive) | required | yes | rung 3 of the YAML-parseability chain below; the out-of-diff falsification check; the Closer's squash-merge identity verification; the Implementer's pre-commit secret scan (`secret_scan_pattern`) in both subagent briefs — see "How this list was derived" for exact locations | rung 3 of the mandatory YAML-parseability check has no working implementation left if `python3` and `node` are *also* unavailable — the one case in this file that **STOPs** the pre-flight instead of reporting (see "Report vs. STOP" below) |
| `node` | **preferred-and-degradable** | yes | rung 2 of the YAML-parseability chain below | falls to rung 3 (weaker coverage, see below); reported once, never a STOP by itself |
| `python3` | **preferred-and-degradable** | yes | rung 1 of the YAML-parseability chain (`skills/work-issue/SKILL.md`, "AGENTS.md mandatory check" §2; `skills/init-agents/SKILL.md`, "Refine workflow" §2) | falls to rung 2 (`node`); reported once, never a STOP. **Confirmed absent in this container** (`which python3` → exit 1) |
| `yq` | **preferred-and-degradable** | yes | `/init-agents`, "Repo-registry update" (write `agents_md_exists: true` into `~/.claude/work-issue-paths.yaml`) | falls to the already-documented `sed`-based edit of the same file; reported once, never a STOP. **Confirmed absent in this container** |
| `jq` | not a dependency | no | none — every `jq`-shaped instruction is `gh --jq`, which is `gh`'s own embedded evaluator (verified above) | n/a — never probed, never reported |
| `sed`, `awk`, `sort`, `diff` | required (baseline POSIX tooling) | no | `awk` and `grep -F` — the out-of-diff falsification check's path filter; `sort -u` — the Closer's squash-merge identity read; `diff -r` — the live-path drift check and the pre-deploy drift check, both non-blocking warnings; `sed` — the `yq`-absent fallback (locations: "How this list was derived") | same posture as `git`/`gh`: assumed present, not probed. None of the three measured failures in #113 or #106 traces to one of these, and none has ever been observed absent in a container this plugin has run in |

**A second way rung 2 can fail, distinct from `node`'s own absence above:** `node` present but
the plugin-internal parser fails to *load* — canonical statement, consequence and the guarded
invocation that catches it: "The YAML-parseability fallback chain", rung 2, "A load failure is
not a syntax error" below. Not restated here.

### Probing

Probe exactly the rows marked **Probed: yes** above — `grep`, `node`, `python3`, `yq` — with a
plain presence check, nothing more:

```bash
for tool in grep node python3 yq; do command -v "$tool" >/dev/null 2>&1 || echo "$tool: absent"; done
```

**Why `git`/`gh` are excluded from the probe rather than merely assumed.** Probing presupposes the
pre-flight itself is already running — and the pre-flight cannot resolve the repo path, read
`AGENTS.md`, or execute the claim protocol (`skills/work-issue/SKILL.md`, "Claim protocol") without
`git`/`gh` already working. Asking "is `git` present" from inside a stage whose own presence
already required `git`/`gh` to work is not a check that can fail usefully — there is no path by
which the probe runs, finds them absent, and still produces a report. This is also why they are
excluded from "the one exception" below rather than qualifying for it by the exception's literal
wording: the exception is scoped to **Probed: yes** rows only.

## The YAML-parseability fallback chain

Replaces the single hard-coded `python3 -c "import yaml; yaml.safe_load(...)"` step everywhere it
appeared (`skills/work-issue/SKILL.md` "AGENTS.md mandatory check" §2; `skills/init-agents/
SKILL.md` "Refine workflow" §2). Three rungs, tried in order, each with a stated and *tested*
coverage boundary — this is the "each rung's coverage stated" the issue's AC asks for, not an
assertion:

**Rung 1 — `python3 -c "import yaml; yaml.safe_load(...)"`.** Full PyYAML coverage: every legal
YAML 1.1 construct (anchors/aliases, arbitrary nesting, all scalar styles, merge keys). This is
the strongest rung and the one this repo cannot currently reach (`python3` absent).

**Rung 2 — `node` against `checks/lib/yaml.js`'s `parseFrontmatter()`.** This repo's own
zero-dependency YAML-*subset* parser (built for the structural check layer). **Its subset and
limits are canonical in `CONTRIBUTING.md`, "The YAML parser, and its limits" — not restated here.**
Read there; this section states only what is specific to running it as *this rung*, against an
arbitrary target repo's `AGENTS.md`, rather than against this plugin's own files:

- **The rung's principal risk is a false STOP, not a false pass.** `CONTRIBUTING.md`'s table
  names four constructs the parser *rejects* with an error; the sharpest for this rung is a
  mapping nested at four spaces (or any width other than exactly two), which raises `unexpected
  indentation (expected 2 spaces, found 4)`. A target repo's `AGENTS.md` legitimately written
  with four-space nesting — valid YAML, accepted by rung 1 or by the skill loader itself — gets
  the pre-flight's `"AGENTS.md has a syntax error in the YAML frontmatter"` STOP on this rung, for
  a file that is not actually broken. This is the coverage gap that matters operationally, because
  rung 2 is no longer only a repo-check-layer detail — it now runs against repos this plugin does
  not control the formatting of.
- **Three constructs pass silently with a wrong value instead of erroring** — anchors/aliases, a
  flow mapping (`{a: 1}`), and a second `---`-fenced block after the first — all documented in the
  same `CONTRIBUTING.md` table. None of the three has been observed in a shipped `AGENTS.md` or
  `SKILL.md` frontmatter; they matter here only as a stated limit, not an active incident.
- **Tested independently for this rung** (not merely inherited from `CONTRIBUTING.md`'s own
  verification): a syntax error still raises correctly — against a copy of this repo's real
  `AGENTS.md` with the closing quote deleted from line 3's `branch_pattern:` value, rung 2 raised
  `unterminated quoted scalar (line 3)`; against the unmodified file, it parsed clean (five
  top-level keys reported).
- **A load failure is not a syntax error.** The parser (`checks/lib/yaml.js`) is
  **plugin-internal** — no consuming repo has this file — while the AGENTS.md being read is the
  **target repo's own data**. If the `require()` below cannot resolve the parser, that is the
  probe's own machinery missing, not a defect in the target's YAML: the invocation below catches
  that case separately and exits `2` (`RUNG2_UNAVAILABLE`), distinct from a real YAML error's
  exit `1`. A caller seeing exit `2` **degrades to rung 3** and reports it in the pre-flight
  report as a degrade — the same posture `node`'s own absence at the probe already has (see "The
  list" row above) — and must **not** map it to the `"AGENTS.md has a syntax error in the YAML
  frontmatter"` STOP (`skills/work-issue/SKILL.md`, "AGENTS.md mandatory check" §2). This is a
  failure mode about whether the parser loads at all, distinct from anything `CONTRIBUTING.md`'s
  coverage table describes about what it accepts once loaded.

Invocation. The two paths inside this script mean two different things and must stay different —
do not "fix" them into agreement. `checks/lib/yaml.js` is **plugin-internal** and is reached
**skill-relative**, resolved from `skills/work-issue/` (this reference file's own directory),
exactly the way `{{git_conventions}}`'s `../github/SKILL.md` already is (`skills/work-issue/
SKILL.md`, "Transcluded git/gh conventions"): from that directory the parser is
`../../checks/lib/yaml.js`. There is **no** `CLAUDE_PLUGIN_ROOT` and **no** plugin-cache lookup —
the plugin's own directory layout is the only thing that has to hold, and it holds identically in
a local checkout and an installed cache. `<skill_dir>` below stands for the absolute path to
`skills/work-issue/` on disk — the stage already knows it, having just read this file from there —
and must be resolved to an absolute path **before** this command is built: a bare relative
`require()` argument resolves against the *process's* working directory, which at this point is
`<repo_path>` (the target repo), not the plugin, so passing the relative string through unresolved
reproduces exactly the failure this rung exists to avoid. `<repo_path>/AGENTS.md` on the next line
is correct as written and stays `<repo_path>`-rooted — that one *is* the target repo's own file:

```bash
node -e "
const fs = require('fs');
let parseFrontmatter;
try {
  ({ parseFrontmatter } = require('<skill_dir>/../../checks/lib/yaml.js'));
} catch (e) {
  console.error('RUNG2_UNAVAILABLE: cannot load the plugin-internal parser (' + e.code + '): ' + e.message);
  process.exit(2);
}
try {
  const r = parseFrontmatter(fs.readFileSync('<repo_path>/AGENTS.md', 'utf8'));
  if (r === null) { console.error('no frontmatter block found'); process.exit(1); }
} catch (e) {
  console.error('YAML error: ' + e.message + ' (line ' + e.line + ')');
  process.exit(1);
}
"
```

**Demonstrated against a target that is not this repo** — the one proof this file did not
previously have, since rounds 1–2 tested only the rungs' coverage claims against copies of this
repo's own `AGENTS.md`. A throwaway directory under `/tmp` held nothing but a copy of this repo's
`AGENTS.md` (never the repo's own file, and removed immediately after):

```
$ ls /tmp/c113target
AGENTS.md
$ node <the invocation above, <skill_dir> and <repo_path> resolved to /tmp/stagecrew-113-wt/skills/work-issue and /tmp/c113target>
parsed OK: 5 top-level keys
```

Then the same throwaway target with a deliberately broken frontmatter (closing quote deleted from
line 3's `branch_pattern:` value, the same construct used in "Tested independently" above):

```
$ node <the same invocation, against the broken copy>
YAML error: unterminated quoted scalar (line 3)
```

And the failure being fixed, reproduced once more for the record — the pre-fix, `<repo_path>`-
rooted `require()` against the same throwaway target, run unguarded exactly as it shipped through
round 2:

```
$ node -e "require('/tmp/c113target/checks/lib/yaml.js')"
node:internal/modules/cjs/loader:1433
  throw err;
Error: Cannot find module '/tmp/c113target/checks/lib/yaml.js'
...
  code: 'MODULE_NOT_FOUND'
Node.js v22.23.2
exit=1
```

Uncaught — the failure escapes as a Node stack trace, indistinguishable by a caller from any other
crash, because the `require()` sat outside every `try` block. The guarded invocation above catches
exactly this and reports `RUNG2_UNAVAILABLE`, exit `2`, instead.

**Rung 3 — structural scan (`grep`/`sed` only, no `python3`, no `node`).** The weakest rung:
confirms the file opens with a `---` fence and has a second `---` fence, then confirms each of the
11 mandatory `work-issue:` field names appears as a `  <field>:` key line somewhere inside the
block. **Cannot verify YAML syntax at all** — indentation, quoting, duplicate keys and value type
are all invisible to it. Tested against the same unterminated-quote copy used for rung 2: rung 3
reported "fences present, all named field keys found by name" — a **false clean pass** on a file
rung 2 correctly rejects. This gap is not hidden; it is the reason rung 3 is last, not first.
Tested against a copy with a field name (`linter:`) deleted entirely: correctly reported it
missing. So rung 3 catches *omission*, not *corruption* — state both when reporting a rung-3
result.

```bash
command -v grep >/dev/null 2>&1 || { echo "grep unavailable — rung 3 has nothing to run on"; exit 1; }
first="$(sed -n '1p' "$AGENTS_MD")"
[ "$first" = "---" ] || { echo "no opening frontmatter fence"; exit 1; }
fences="$(grep -c '^---$' "$AGENTS_MD")"
[ "$fences" -ge 2 ] || { echo "fewer than two frontmatter fences ($fences)"; exit 1; }
missing=""
for field in branch_pattern default_branch pr_base commit_format syntax_check smoke_test \
             deploy_command linter hard_gates default_oos ac_templates; do
  grep -qE "^  ${field}:" "$AGENTS_MD" || missing="$missing $field"
done
[ -z "$missing" ] || { echo "field name(s) not found as a key line:$missing"; exit 1; }
echo "structural scan: fences present, all named field keys found (types/values NOT verified)"
```

This is the **guarded version** — the `command -v grep` check on the first line is what makes it
guarded, and `missing` is initialised before the loop so an ambient `missing` left over in the
caller's shell cannot leak into the verdict.

**If rung 3 itself has nothing to run on** (`grep` unavailable) **and rungs 1–2 are also
unavailable**, the mandatory YAML-parseability check has no working implementation at all. This
is deliberately **not** a silent pass. Tested against the *unguarded* form of the same script
(the `command -v grep` line above removed) under a genuinely `grep`-free `PATH`
(`env -i PATH=<dir with only sed/cat/bash>`, not a failing shim):

```
$ env -i PATH=<grep-free-dir> AGENTS_MD=AGENTS.md bash rung3.sh
rung3.sh: line 3: grep: command not found
rung3.sh: line 4: [: : integer expression expected
fewer than two frontmatter fences ()
exit=1
```

The unguarded script does **not** reach the per-field loop and does **not** produce a false
"field not found" verdict — it dies at the **fences** check, before the loop is ever entered,
because `$(grep -c ...)` returns empty output when `grep` is missing and `[ "$fences" -ge 2 ]`
then fails on a non-numeric comparison. It exits 1, but with a misleading message pointing at
"fewer than two frontmatter fences" on a file that may have both fences fine — not the silent
continuation past a failed `grep` that an earlier draft of this file claimed. The conclusion is,
if anything, stronger for it: an unguarded rung 3 does not fail *silently*, but it fails
*misleadingly*, naming the wrong defect. That is exactly the silent/misleading-wrong-result
failure class #113 is about, one level down — see "Verification" below. The guarded version above
STOPs with an explicit, accurate message instead:

> AGENTS.md YAML-parseability could not be checked: `python3` absent, `node` absent, and
> `grep`/`sed` (the structural-scan fallback) also unavailable. This is the one case where a
> missing tool STOPs the pre-flight rather than reporting it — the mandatory check has no
> remaining implementation to run. Install one of `python3`, `node`, or `grep`, then re-run
> `/work-issue <num>`.

## The ugrep gotcha

**The finding (#106).** `grep` on a real project container resolved to **ugrep 7.8.4**, whose
default engine is leftmost-longest and does not backtrack. In the #106 loop, a greedy
`[^.]{0,40}`-shaped sweep pattern silently missed the very defect lines the issue was filed for
(`CLAUDE.md:27`, `skills/init-agents/SKILL.md:50`) while other lines in the same recursive sweep
still matched — so the overall command reported hits and exited clean, and the two lines that
mattered were simply absent from the output. The fix used there was `grep -Pnoi` (PCRE2, explicit
engine) with a **lazy** quantifier (`[^.]{0,40}?`) and case-insensitivity — see the #106 issue
thread comments for the full before/after.

**Reproduced independently for this issue**, on a related but distinct construct — a **zero-width
assertion immediately after an optional group**, which is the same "non-backtracking engine
disagrees with a backtracking one" class:

```
$ echo "four skills." | grep -noE '\bfour\b[^.]{0,40}\bskills?\b'
1:four skills
$ echo "four skills." | grep -noE '\b(four)(th)?\b[^.]{0,40}\bskills?\b'
(no output, exit 1)
$ echo "four skills." | grep -noP '\b(four)(th)?\b[^.]{0,40}\bskills?\b'
1:four skills
```

Adding the optional `(th)?` group before the `\b` makes the container's default `grep` miss a
match a PCRE2 engine (`-P`) finds instantly — the same failure class as #106's greedy-quantifier
case, on a different construct, confirming the risk is not limited to one pattern shape.

**A container nuance worth recording.** In the interactive shell this plugin's stages actually run
their bash commands in, unqualified `grep` is not `/usr/bin/grep` — `type -a grep` /
`declare -f grep` show it is a shell **function** the harness injects, which shims to the harness's
own binary in an ugrep-compatible mode (`ARGV0=ugrep ...`). The real system binary, reachable via
`command grep` or from any non-interactive shell (`bash --noprofile --norc -c 'type grep'`
resolves it straight to `/usr/bin/grep`, **GNU grep 3.8**, which backtracks normally), does not
have this behavior at all. Because a `/work-issue` stage's shell commands run through the shimmed
function (it is what `grep` means, unqualified, in that shell), the ugrep-safe posture below is
the one that matters for this loop regardless of what the underlying system binary would do.

**Every actual grep-pattern invocation shipped today was re-verified against this container's
default `grep` (the ugrep-shimmed one)** — see "Verification" below. None needed rewriting: they
already use `-F` (fixed-string, immune to backtracking questions entirely), an anchored literal
with no quantifiers (`^Co-authored-by:`), or a character class with only **unbounded** trailing
quantifiers and no optional group adjacent to a `\b` (the `secret_scan_pattern`, and the
create-issue secret-token trigger pattern). **Prefer the first** per the issue's own guidance
("a pattern that works everywhere beats a documented assumption") — a new pattern in a shipped
skill should reach for `-F` or an anchored literal before reaching for a quantified/optional
regex; if one is genuinely needed, verify it here (or ship it with an explicit `-P`) before it
ships.

## Verification — every grep pattern in the shipped skills, re-tested

| Location | Pattern (or type) | Re-tested under this container's default `grep` | Result |
|---|---|---|---|
| `skills/work-issue/SKILL.md`, "Out-of-diff falsification check" | `grep -rn -F -f <terms> . --include='*.md'` | fixed-string match, no regex engine involved | safe by construction |
| `skills/work-issue/SKILL.md`, "Squash-merge identity check (report, never a gate)" | `grep -c '^Co-authored-by:'` | anchored literal, no quantifiers | safe |
| `skills/work-issue/SKILL.md`, "Stage 2 — Implementer (type dispatch)" (`secret_scan_pattern`); also `skills/work-issue/references/subagent-briefs/code-implementer.md` and `research-implementer.md` (same pattern via `{{secret_scan_pattern}}`) | `(ghp_[A-Za-z0-9]{30,}\|sk-ant-[A-Za-z0-9_-]{40,}\|TELEGRAM_BOT_TOKEN=[0-9]+:[A-Za-z0-9_-]+\|API_KEY=[a-zA-Z0-9]{20,})` used as `grep -iE` | ran against four synthetic matching strings, one per alternative | all four matched, exit 0 |
| `skills/create-issue/SKILL.md`, "Issue-type detection", trigger 3 | `[A-Z_]+_(KEY\|TOKEN\|SECRET\|PAT)` | ran against three synthetic matching strings | all three matched, exit 0 |

No pattern in the current shipment needed a rewrite. This table is what "verified safe under
ugrep, or the assumption is documented" resolves to today — re-run it whenever a skill adds a new
`grep` pattern with a quantifier or an optional group, since that is exactly the shape both
#106 and the reproduction above broke on. Citations are section names, not line numbers — a line
number in a file this change (or a later one) edits goes stale the moment it is committed, which
is exactly what happened to this table's own previous citations (see "How this list was derived").

## Report vs. STOP

Same posture as the code-graph MCP's graceful degradation (`skills/work-issue/SKILL.md`,
"Code-graph pre-flight — graceful degradation") and the `strategy.gates` consistency report
(`skills/work-issue/SKILL.md`, "Optional `strategy.gates` consistency report"): **a report, never
a STOP**, printed once, before stage 1, and **silent when nothing is missing or degraded** — an
empty report is never printed as "all OK" (same rule the gates report states explicitly; a
pre-flight that reports its own silence trains the reader to skip it).

Format, one line per missing-or-degraded tool:

```
Tool availability (skills/work-issue/references/tool-requirements.md) — report only, never a STOP
  python3 is absent — AGENTS.md YAML-parseability falls back to node (rung 2:
  checks/lib/yaml.js, YAML-subset coverage — see "The YAML-parseability fallback
  chain").
  yq is absent — the /init-agents repo-registry write falls back to a sed-based
  edit (see skills/init-agents/SKILL.md, "Repo-registry update").
```

Everything present → print nothing.

**The one exception, scoped precisely.** Among **Probed: yes** rows only — `grep`, `node`,
`python3`, `yq` — a tool a *mandatory* pre-flight step itself depends on, with no rung left to
fall back to, STOPs instead of reporting: a report implies the run continues, and nothing here can
make the mandatory AGENTS.md YAML-parseability check pass with zero working implementations. Today
exactly one row reaches this — `grep`, if rung 3 is reached with `python3` and `node` both also
unavailable (see the STOP message under "The YAML-parseability fallback chain" above). `git` and
`gh` do **not** qualify, and not merely because this file exempts them: they are **Probed: no** by
construction (see "Probing" above) — the exception applies only to a tool the probe can name as
absent, and the probe cannot pose that question about the infrastructure it is itself running on.
This mirrors the code-graph MCP's own posture exactly: that mechanism is *never* mandatory, so it
never has this exception; the YAML-parseability check *is* mandatory (AGENTS.md mandatory check
§2), so its one dependency among the probed rows does.

## Substitution is never silent

**Canonical statement: `skills/work-issue/SKILL.md`, "Tool availability pre-flight" (last
paragraph).** Not restated here — it is a cross-stage behavioural rule binding all five stages,
not a fact about this file's tool list, so it lives with the other cross-stage rules in `SKILL.md`
rather than in this `references/` file. This file's report (see "Report vs. STOP" above) is one
input to that rule, not a second copy of it.
