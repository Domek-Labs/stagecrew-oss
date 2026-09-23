# ADR-0002: Optional Visual Reviewer Gate in AGENTS.md

## Status

Accepted.

## Context

Frontend issues currently pass the loop on a green build alone. Nobody looks at the rendered UI. A build can succeed while the page renders broken: horizontal overflow on a phone viewport, a primary action pushed below the fold, a runtime console error that no unit test exercises. The Tester proves "it builds and the ACs' smoke tests pass"; the Critic reads the diff. Neither one *sees* the result.

The gap is specifically visual and specifically frontend. It does not belong on the loop-type axis (`code` vs `research`): a frontend change still ships a **code diff** and still wants the code-implementer brief, the build-green Tester, and the code Critic. Turning "frontend" into a third loop-type would fork the entire code pipeline just to bolt on a screenshot check, and the two forks would drift.

The right axis is the same one the Component Registry uses: an **opt-in AGENTS.md block** that layers an extra gate onto the existing pipeline, scoped to the issues it applies to, and absent → zero behavior change.

## Decision

Introduce an optional `visual:` block in `AGENTS.md` YAML frontmatter and a new **Visual Reviewer** stage (3.5) in `/work-issue`, running between the Tester (build green) and the Critic. It is a **gate, not a loop-type**.

### Schema

```yaml
visual:
  serve_command: "npm run preview"     # required if block present — how to serve the built frontend
  base_url: "http://localhost:4173"    # required — where the served app answers
  viewports:                           # optional; default [390x844 mobile, 1280x800 desktop]
    - { w: 390,  h: 844,  label: mobile }
    - { w: 1280, h: 800,  label: desktop }
  routes: ["/"]                        # optional default routes; the issue can override/extend
  console_error_policy: "fail"         # fail | warn (default fail)
  screenshot_dir: ".stagecrew/visual"  # optional — where screenshots are saved before upload
  scope: "frontend"                    # visual review only applies to frontend work
```

Absent block → the gate is skipped silently. Pure-Reader principle.

### Trigger

The stage fires only when **both** hold: (1) AGENTS.md carries a `visual:` block, and (2) the issue is frontend-scoped — files-to-touch match a frontend glob OR the Spec/AC contain a frontend keyword (`page`, `route`, `UI`, `component`, `layout`, `responsive`, `screen`, `viewport`). Non-frontend issues in a `visual:`-enabled repo skip the gate cleanly.

### Enforcement design

- **`/create-issue`** injects a `### Visual Acceptance (AGENTS.md visual:)` AC sub-block when the issue is in scope (mirrors the Component Reuse Check injection).
- **`/work-issue` stage 3.5 (Visual Reviewer)** serves the built frontend, drives Playwright per route × viewport (mobile first), captures screenshots + a11y snapshots + console output, and evaluates the Visual Acceptance ACs. Verdict `## [stage:visual] PASS|FAIL` with screenshots attached.
- **FAIL** routes back to the Implementer via REVISE and shares the existing 3-revise hard cap.

### Dependency

The gate needs the **Playwright companion MCP** (`mcp__playwright__*`). Like the other companion MCPs (codebase-memory, MemPalace), it is optional: when the namespace is absent the stage is skipped with a note, never a hard fail.

### Mobile-first default

The default viewports review the mobile viewport (390×844) before desktop, and the "visible above the fold" AC is checked at the mobile viewport. Frontends are consumed on phones first; the gate encodes that.

### Version bump

`minor` per `version_policy` — a new AGENTS.md field with a safe default (absent = zero behavior change), backwards-compatible for existing AGENTS.md files.

## Alternatives considered

### Alternative A — new `frontend` / `visual` loop-type

A third loop-type parallel to `code` and `research`, with its own implementer brief.

- **Pros:** discoverable via `--type=frontend`; label-driven dispatch already exists.
- **Cons:** frontend work still produces a code diff, so 90% of the code-implementer / Tester / Critic / Closer is duplicated purely to add a screenshot check; two briefs drift; the loop-type axis is *deliverable shape* and this changes only *verification*, not deliverable. Rejected — wrong axis.

### Alternative B — fold the check into the Tester

Extend the existing Tester stage to also run Playwright, no separate stage or comment.

- **Pros:** no new stage; fewer moving parts.
- **Cons:** conflates "build/ACs green" with "renders correctly" in one verdict and one comment; loses the clean `[stage:visual]` audit entry with attached screenshots; makes the browser dependency implicit inside every Tester run. Rejected — the gate deserves its own auditable verdict.

### Alternative C — pixel-diff / visual-regression baselines

Store screenshot baselines and diff against them per PR.

- **Pros:** catches unintended visual drift precisely.
- **Cons:** baseline storage + churn, flakiness across fonts/renderers, and it answers "did it change" not "is it correct" — the wrong question for a first-implementation gate. Deferred as a possible follow-up, not the primitive.

## Consequences

### Immediate

- New AGENTS.md field, opt-in, backwards-compatible. `minor` version bump.
- `/init-agents` documents the `visual:` schema in its template.
- `/create-issue` injects a Visual Acceptance AC block for in-scope issues.
- `/work-issue` gains stage 3.5 (Visual Reviewer), a `visual` state-tracker field, and the FAIL→revise routing under the shared 3-revise cap.
- A new subagent brief (`skills/work-issue/references/subagent-briefs/visual-reviewer.md`).
- Playwright documented as a new optional companion MCP.
- This ADR.

### Loop cost

- Zero overhead in repos without a `visual:` block, and in non-frontend issues within a `visual:`-enabled repo.
- When it fires: one browser session, `routes × viewports` navigations, and the screenshot uploads. Bounded by the declared routes/viewports.

### Follow-ups (out of scope for this ADR)

- Pixel-diff / visual-regression baselines (Alternative C).
- Automated route discovery from the router config instead of a declared `routes` list.
- Auth'd-route review (login flow before navigation).

## Battle-test observations

The end-to-end battle-test on a real frontend repo is a follow-up run to this loop.

- **Target repo identifier:** _TBD after battle-test run_
- **Loop-friction observations:** _TBD after battle-test run_
  - Serve-command reliability (cold start, port conflicts): _TBD_
  - False-positive rate of the frontend-scope trigger: _TBD_
  - `console_error_policy: fail` noise (third-party console errors): _TBD_
  - Screenshot upload cost per loop: _TBD_
