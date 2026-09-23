---
name: loop
description: >
  Loop-workflow umbrella. Routes to /init-agents (bootstrap), /create-issue (genesis), /plan-issues (backlog planning) or /work-issue (5-stage execution, merges in-loop). Triggers: "loop", "loop workflow", "work issue", "spec build", "coding loop", "github workflow", "github loop", "spec build loop". Routes when intent is unclear.
---

# /loop — Loop-Engineering Workflow (Umbrella)

**Type:** umbrella / router

## Purpose

Central entry point for the stagecrew pipeline: GitHub issue → reviewed, merged PR (or research findings) via a multi-stage agent pipeline.

Four sub-skills cover the full lifecycle:

| Phase | Sub-skill | What | Direct trigger |
|-------|-----------|------|----------------|
| **Bootstrap** | `/init-agents` | Create `AGENTS.md` for a repo (one-time per repo, pure-reader prerequisite) | "init agents", "create agents.md", "coding spec bootstrap", "initialize repo standards" |
| **Genesis** | `/create-issue` | Idea → fully-specified GitHub issue (spec standard with Idea/AC/Files/Test-Plan/OoS) | "create issue", "new issue", "create feature", "spec issue", "idea as ticket" |
| **Planning** | `/plan-issues` | Derive the actionable work-list (`<goal>` minus `<waiting-on>:*`) from the open issues before work starts; resolve `area:`/`bundle:` labels; print the start-time collision report | "plan issues", "backlog plan", "work-list", "plan before work" |
| **Execution** | `/work-issue` | Issue → reviewed, merged PR via 5 stages (Validator → Implementer → Tester → Critic → Closer); the Closer merges in-loop (squash-merge, issue close, remote-branch delete, deploy — semantics: `skills/work-issue/SKILL.md`, "Closer merge behavior") | "work issue", "drive issue", "loop workflow", "spec build loop" |

## Workflow at a glance

```
Bootstrap          Genesis          Planning        Execution
    │                 │                │                │
    ▼                 ▼                ▼                ▼
/init-agents  →  /create-issue  →  /plan-issues  →  /work-issue
(AGENTS.md)     (GitHub issues)   (work-list)     (5 stages →
                                                   merged PR
                                                   + deploy)
```

All sub-skills are **pure-readers** — they read `AGENTS.md` at the repo root as the single source of truth for standards.

## Typical sequence for new repos

```
1. /init-agents --repo <owner>/<slug>      # create AGENTS.md (once per repo)
2. /create-issue "<idea>"                  # spec the issue(s)
3. /plan-issues                            # derive the work-list (for multi-issue runs)
4. /work-issue <num>                       # drive each issue (Validator → ... → Closer merges in-loop)
```

Steps 2–4 are called one at a time; there is no single-command wrapper around them. Step 3 is optional for a single issue and recommended once several are in flight.

## What happens when /loop is invoked directly

Clarify intent with a single question, then route:

```
What do you want to do?

  1) Create AGENTS.md for a new repo                    → /init-agents
  2) Capture a new idea as an issue                     → /create-issue
  3) Plan the work-list for open issues                 → /plan-issues
  4) Drive an existing issue (5-stage loop)             → /work-issue
```

## When to use which skill

| Situation | Skill |
|-----------|-------|
| New repo, no AGENTS.md yet | `/init-agents --repo <slug>` |
| New idea, no issue yet (AGENTS.md exists) | `/create-issue "..."` |
| New idea, AGENTS.md missing | `/create-issue "..."` (calls `/init-agents` as a pre-step) |
| Multiple issues to run in parallel | `/plan-issues` first, then `/work-issue` per work-list issue |
| Issue exists with a complete spec | `/work-issue <num>` |
| Issue exists without a spec | `/create-issue --refine <num>` then `/work-issue` |
| `/work-issue` Validator returned STOP | `/create-issue --refine <num>`, then `/work-issue` retry |
| `/work-issue` returns STOP "AGENTS.md missing" | `/init-agents --repo <slug>`, then `/work-issue` retry |
| AGENTS.md exists but has gaps | `/init-agents --refine --repo <slug>` |
| Want to go from an idea to a merged PR | `/create-issue "..."`, then `/work-issue <num>` (with `/plan-issues` in between for several issues) |

## Example calls

```
# New repo, full loop
/init-agents --repo myorg/myrepo
/create-issue --repo myorg/myrepo "add JWT refresh endpoint"
/plan-issues --repo myorg/myrepo
/work-issue 42 --repo myorg/myrepo

# Drive an existing issue
/work-issue 17

# Plan and launch parallel loops for open issues
/plan-issues --repo myorg/myrepo --milestone "v2.0"
# → shows the work-list, user confirms → /work-issue runs per issue

# Unclear intent
/loop
# → asks one question, then routes to one of the four sub-skills
```

## Why an umbrella

Four sub-skills, one umbrella. The full lifecycle of a feature:

- `/init-agents` = capture standards (AGENTS.md)
- `/create-issue` = capture intent (GitHub issue)
- `/plan-issues` = determine the work-list (goal + waiting-on)
- `/work-issue` = execute intent (issue → reviewed, merged PR)

## Roadmap

See the repo issues (labelled `roadmap`) for the rolling roadmap. Version numbers for roadmap items are intentionally not tracked here — see `AGENTS.md` `version_policy` for the bump policy. The current version lives only in `.claude-plugin/plugin.json`.

## See also

- `skills/init-agents/SKILL.md`
- `skills/create-issue/SKILL.md`
- `skills/plan-issues/SKILL.md`
- `skills/work-issue/SKILL.md`
- `skills/github/SKILL.md` — reference skill (git/gh interaction conventions), not a pipeline phase
- `../CLAUDE.md` (plugin quickstart)
