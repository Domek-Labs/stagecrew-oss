'use strict';

// Check 5 — every SKILL.md opens with well-formed YAML frontmatter carrying
// `name` and `description`.
//
// Canonical source: the Claude Code skill loader. This is deliberate (issue #80,
// decision 9). The obvious alternative — parsing the English hard-gate sentence
// in AGENTS.md — would itself be a copy under that gate's own drift test: reword
// the sentence and the parser breaks. `name` and `description` are what the
// loader requires to load a skill at all; that is a fact about an external
// runtime, not about this repo's prose. The gate and this check agree because
// both describe the same reality, and neither is derived from the other.
//
// Notably NOT required: `model` and `allowed-tools`. The loader treats them as
// optional (see docs/adr/0014), and no shipped skill sets `model`.

const fs = require('fs');
const path = require('path');
const { defineCheck, finding, skillFiles, REPO_ROOT, runAsCli } = require('./lib/check');
const { parseFrontmatter, YamlError } = require('./lib/yaml');

// What the loader needs before it can load a skill at all.
const LOADER_REQUIRED_KEYS = ['name', 'description'];

const check = defineCheck({
  id: 5,
  title: 'every SKILL.md has well-formed YAML frontmatter with name and description',
  canonical: "the Claude Code skill loader's frontmatter requirement (external)",
  run() {
    const findings = [];
    for (const relPath of skillFiles()) {
      const text = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
      let parsed;
      try {
        parsed = parseFrontmatter(text);
      } catch (err) {
        if (err instanceof YamlError) {
          // Not "malformed YAML": the parser reads a documented SUBSET, and input
          // outside it may still be perfectly valid YAML the loader accepts. Say what
          // is true and send the reader to the file and line to judge for themselves.
          findings.push(
            finding(
              relPath,
              err.line,
              `frontmatter at this line is outside the YAML subset this layer parses (${err.message}) — ` +
                "read the line before assuming a defect: it may be valid YAML the skill loader accepts. " +
                `Subset and its limits: CONTRIBUTING.md, "The YAML parser, and its limits"`
            )
          );
          continue;
        }
        throw err;
      }
      if (parsed === null) {
        findings.push(finding(relPath, 1, 'no `---` fenced frontmatter block at the top of the file'));
        continue;
      }
      for (const key of LOADER_REQUIRED_KEYS) {
        const value = parsed.data[key];
        if (value === undefined || value === null || String(value).trim() === '') {
          findings.push(
            finding(relPath, parsed.block.firstLine, `frontmatter carries no non-empty \`${key}\`, which the loader requires`)
          );
        }
      }
    }
    return findings;
  },
});

module.exports = check;
if (require.main === module) runAsCli(check);
