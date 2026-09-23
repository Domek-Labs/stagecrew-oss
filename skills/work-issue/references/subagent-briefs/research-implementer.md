# Subagent brief — loop type: `research` / stage: Implementer (= Researcher)

**Used by:** `/work-issue` stage 2 when the issue label is `loop-type:research`.

**Loaded by:** `skills/work-issue/SKILL.md` for the subagent-brief selection.

**Placeholders:** `{{slug}}`, `{{repo_path}}`, `{{worktree_path}}`, `{{issue_num}}`, `{{pr_base}}`, `{{topic_slug}}`, `{{date}}`, `{{secret_scan_pattern}}`, `{{commit_identity}}`, `{{git_remote}}`, `{{model}}`, `{{effort}}` — substituted at render time from the AGENTS.md cache + state tracker. **Two placeholders are the exceptions — `{{git_conventions}}` and `{{delegation_rule}}`:** neither is a per-repo value; both are **transcluded** from text that ships inside the plugin. `{{git_conventions}}` carries the git/gh conventions from `skills/github/SKILL.md`, delimited block only, resolved skill-relative as `../github/SKILL.md` (see `skills/work-issue/SKILL.md`, "Transcluded git/gh conventions (`{{git_conventions}}`)"); `{{delegation_rule}}` carries the nested-spawn rule from the delimited block in `skills/work-issue/SKILL.md` (see "Transcluded delegation rule (`{{delegation_rule}}`)"). Both rule sets are canonical there and are **never** copied into this brief. `{{commit_identity}}` is `null` when the optional `commit_identity:` block is absent from AGENTS.md. `{{git_remote}}` is the GitHub working remote from the repo registry (`git_remote` field); it falls back to `origin` when the registry does not declare one. `{{model}}` is the resolved model alias for this stage or `inherited` when no override is set; `{{effort}}` is the resolved effort level or `default` when no override is set. Both are recorded on the stage comment's audit line; the effort level is a record of what was requested, not of what ran.

---

## Briefing (template)

> You are the **Researcher** for issue #{{issue_num}} in repo `{{slug}}` (checkout `{{repo_path}}`, worktree `{{worktree_path}}`).
> The Validator returned GO.
>
> **You write no implementation code.** Your deliverable is a **findings document**
> at `docs/research/{{topic_slug}}-{{date}}.md`. Code diffs are only allowed for
> **debug logging** and are reverted before PR or isolated in a throwaway branch.
>
> {{delegation_rule}}
>
> ### Working directory
>
> ```bash
> cd {{worktree_path}}
> ```
>
> Operate inside the worktree (see SKILL.md "Git worktree isolation"): the loop already created it and
> checked out your branch `research/{{topic_slug}}`, cut from `{{pr_base}}`. Do **not** `cd {{repo_path}}`,
> check out `{{pr_base}}`, or re-create the branch.
>
> **Branch pattern:** `research/<topic-slug>` (instead of `feature/...`). Clearly identifies
> a research loop to the reviewer.
>
> **Debug edits:** if you add temp DEBUG logging in provider/bridge/service files
> to inspect request/response bodies:
> - Option A: revert before commit (`git checkout -- <file>`)
> - Option B: isolate in a separate `debug/<topic-slug>` branch that is NEVER merged
> - **Never** ship debug edits in the final research PR
>
> ### Phases
>
> #### Phase 1 — define the test matrix
>
> Read issue spec section 3 (test-matrix axes). At least 2 axes. Build a table of
> all combinations you will test. Estimate effort per cell.
>
> #### Phase 2 — run direct probes
>
> Per test-matrix cell:
> 1. Run the probe (curl / API call / benchmark run / etc.)
> 2. **Save raw output** (JSON, log snippet, timing)
> 3. Per cell: result (PASS/FAIL/PARTIAL), latency, note
>
> Required: at least **6 probes** documented.
>
> #### Phase 3 — baseline-vs-candidate comparison
>
> If relevant: comparison between baseline (e.g., current implementation) and
> candidate (e.g., direct API call without wrapper). Identify differences.
>
> #### Phase 4 — write the findings doc
>
> File: `docs/research/{{topic_slug}}-{{date}}.md`. Required content:
>
> 1. **Executive summary** — the TL;DR a reviewer reads first: the research
>    question, the answer, and whether a working setup was found
> 2. **Test-matrix table** with all probes (axes as rows/columns)
> 3. **Finding per axis** (insights, patterns)
> 4. **Root cause / main finding** (what is the answer to the research question?)
> 5. **Concrete recommendations** with code sketch (no diff, just a sketch)
> 6. **Working setup** (if found) OR **hypothesis roadmap**
>    (if not: which hypothesis to probe next)
> 7. **Follow-up implementation-issue spec** (proposed title, AC skeleton,
>    files-to-touch) as an appendix
> 8. **Sources list** (links to docs/specs/examples consulted)
>
> Length follows the content: cover all eight sections in the depth a reviewer
> needs in order to act, and do not pad with filler sections, redundant
> summaries or boilerplate to reach a length. There is no word target and no
> word minimum — a short doc that carries every section with its evidence is a
> good doc. The **at least 6 probes** floor further down is not a length rule
> and stays in force: it is methodological coverage — do not conclude from one
> data point — not an output-style quota. Both points are recorded in
> `docs/adr/0019-length-calibration-over-word-counts.md`.
>
> #### Phase 5 — commit + push
>
> **The git/gh conventions below are binding on this phase.** Your repo's `commit_identity` is `{{commit_identity}}` (`null` = absent). **Your stage creates no PR — §1's PR-open bullet and §4 bind the Closer, not you.**
>
> {{git_conventions}}
>
> ```bash
> git add docs/research/{{topic_slug}}-{{date}}.md
> # do NOT add debug edits
> git diff --cached | grep -iE '{{secret_scan_pattern}}'   # secret scan
> git commit -m "research({{topic_slug}}): findings + follow-up issue spec
>
> ... findings summary ...
>
> Refs #{{issue_num}}"
> git push -u {{git_remote}} research/{{topic_slug}}
> ```
>
> ### Issue comment
>
> `## [stage:implementer] ready for test` with:
> - Branch: `research/{{topic_slug}}`
> - Commit hash
> - Doc path + word count
> - Test-matrix coverage (X of Y cells probed)
> - Finding highlight (one sentence: working setup found? dead end? hypothesis?)
> - AC selfcheck (per checkbox: done? where in the doc?)
> - Suggested follow-up implementation-issue title
> - `model: {{model}}, effort: {{effort}}` — the single audit line that ends this comment. `{{model}}` is the alias that ran this stage; `{{effort}}` is the level **requested** for it, not a claim about what ran (see `skills/work-issue/SKILL.md`, "Per-stage model and effort dispatch").
>
> ### Hard constraints
>
> - **NO** implementation code in the final PR (only the doc + possibly reverted debug edits)
> - **NO** live-service intervention beyond read-probes (pre-flight healthcheck OK)
> - **NO** secrets in the doc (no real API key value, even for probe documentation)
> - **NO** "I did not make progress" docs without a hypothesis roadmap
>
> ### Parent output
>
> Report to the parent with (length: see `skills/work-issue/SKILL.md`, "Issue-comment convention"):
> - Branch + commit
> - Doc path + word count
> - Test-matrix coverage
> - Working-setup status (found / not found + roadmap)
> - Follow-up issue spec stub
> - Anomalies

---

## Parent decision (after Researcher output)

- **OK** → start stage 3 (Tester). **Skip rule:** diff is 100% in `docs/research/**`
  → the Tester brief is a doc-quality check (not `smoke_test`).
- **Working setup not found + no hypothesis roadmap** → ESCALATE.
- **Test-matrix coverage too low** (< 6 probes) → REVISE back to the Researcher.

---

## Tester check criteria (type-specific for `research`)

This loop type resolves `applicable: false` for the execution-evidence gate — no base run, no revert check; canonical in `skills/work-issue/SKILL.md`, "Execution evidence" §1. The doc-quality checklist below is unchanged.

The Tester stage checks for the `research` type **instead of** `smoke_test`:

- [ ] Doc exists at `docs/research/{{topic_slug}}-{{date}}.md`
- [ ] Test-matrix table present (at least 1 Markdown table in the doc)
- [ ] At least 6 probes documented (countable via sub-headers or table rows)
- [ ] Working-setup section OR hypothesis-roadmap section (neither empty)
- [ ] Follow-up implementation-issue spec attached
- [ ] Sources list with at least 1 link
- [ ] No secrets in the doc (pattern scan)

Issue comment `## [stage:tester] <PASS|FAIL>` with per-AC status + a doc quote as evidence.

---

## Critic check criteria (type-specific for `research`)

The Critic stage checks for the `research` type:

- Recommendation is **concrete + actionable** (not "one could try X", but "change X, code sketch: ...")
- Follow-up issue spec is **ready to start** (title + AC skeleton + files-to-touch complete)
- Sources are **reliable** (official docs/specs/PR discussions, not just a top-voted Stack Overflow answer)
- Test matrix is **representative** (do the axes cover the research question?)
- Out-of-scope respected (no implementation code in the diff)
- Out-of-diff falsification check — canonical in `skills/work-issue/SKILL.md`, "Out-of-diff falsification check" (stage 4 step 6). Here §1 is answered over the **findings doc's own claims** rather than over a code diff: a doc that states a default, a verdict, a field's semantics or a documented behaviour is what triggers §2, and the search terms come from the doc's claims
- `hard_gates` check (default_oos, secrets, etc.)

Verdict mapping:
- **APPROVE** → stage 5 (Closer merges as a doc PR)
- **REVISE** → researcher subagent again with the Critic comment as briefing
- **ESCALATE** → spec gap / research question framed wrong

---

## Closer check criteria (type-specific for `research`)

- PR title: `research(<topic>): findings + follow-up issue spec`
- PR body: doc TL;DR + follow-up issue-spec link
- Squash-merge to `{{pr_base}}`
- **Optional but recommended:** after merge, file the follow-up implementation issue via
  `/create-issue --type=code` with the spec stub from the doc
- **(Optional) persist a loop summary** in your knowledge system. If you use
  [MemPalace](https://github.com/MemPalace/mempalace), file a drawer at a research-loop
  location (e.g. `<your-palace>/<your-personal-wing>/<your-process-room>`) so future
  loops can recall what worked. Skip this step if your team uses a different knowledge
  store (or none).
