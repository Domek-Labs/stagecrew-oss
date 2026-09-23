# Example flow: trigger #3 (secret-handling / bearer-token detection)

**Illustrative — not a template.** This file works one of the six issue-type triggers through
end to end so the *shape* of a trigger reaction is visible once: sample spec → detected pattern →
suggested AC items → per-item decision. It is **not** a template for the other five triggers, and
nothing renders from it. The contract — every trigger's condition and its required extension —
is the trigger table in `skills/create-issue/SKILL.md`, "Issue-type detection", which is the only
source for it. Do not generalise this example's wording into a schema, and do not expect the
other five triggers to produce output in this form.

---

**Sample spec block:**
> The skill uses `ANTHROPIC_API_KEY` as an env var for Anthropic SDK calls. The token is loaded from `.env` and injected into the docker-compose stack.

**Detected pattern:** `ANTHROPIC_API_KEY` matches regex `[A-Z_]+_(KEY|TOKEN|SECRET|PAT)`.

**Generated AC items (suggested):**
- [ ] `.env.example` has `ANTHROPIC_API_KEY` with scope comment (which service reads it, which permissions)
- [ ] `docker-compose.yml` `env_file:` references `.env`
- [ ] entrypoint preflight: on missing token warn + skip registration (no hard crash)
- [ ] `git diff --cached` secret scan before commit greps for token pattern (no real value in the diff)

The user decides per AC item: `APPROVE` / `EDIT` / `DISMISS`. If all four items are `DISMISS`ed, a `## Standards Notes` block with the reasoning is appended to the issue.
