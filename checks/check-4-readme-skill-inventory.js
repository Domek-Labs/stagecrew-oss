'use strict';

// Check 4 — README.md's skill inventory lists every skill that ships under
// skills/.
//
// Canonical source: the `skills/` directory. What the plugin ships is a fact
// about the tree, and README is a description of it; the check compares the
// description against the fact and never the other way round.
//
// This is the class of drift #106 fixed: /plan-issues shipped and the shop window
// never mentioned it. Run against commit 45ac33e the check reports exactly that.

const { defineCheck, finding, read, listDirectories, exists, runAsCli } = require('./lib/check');

const README = 'README.md';
const INVENTORY_HEADING = /^(#{2,6})\s+.*\bskills?\b/i;

// The section of README that carries the inventory: the first heading whose text
// names skills, up to the next heading at the same level or higher.
function inventorySection(lines) {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(INVENTORY_HEADING);
    if (!match) continue;
    const level = match[1].length;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].match(/^(#{1,6})\s/);
      if (next && next[1].length <= level) { end = j; break; }
    }
    return { heading: lines[i].trim(), start: i + 1, end, lines: lines.slice(i + 1, end) };
  }
  return null;
}

const check = defineCheck({
  id: 4,
  title: 'README.md lists every skill that ships under skills/',
  canonical: 'the skills/ directory → README.md',
  run() {
    const shipped = listDirectories('skills').filter((name) => exists(`skills/${name}/SKILL.md`));
    const lines = read(README).split('\n');
    const section = inventorySection(lines);

    if (section === null) {
      return [
        finding(
          README,
          null,
          'no heading naming the skills was found, so the shipped skills ' +
            `(${shipped.join(', ')}) are listed nowhere`
        ),
      ];
    }

    const body = section.lines.join('\n');
    const findings = [];
    for (const name of shipped) {
      const mentioned = new RegExp(`(^|[^A-Za-z0-9_/-])/?${name}([^A-Za-z0-9_-]|$)`).test(body);
      if (!mentioned) {
        findings.push(
          finding(
            README,
            section.start,
            `skills/${name}/ ships but the "${section.heading}" section does not list it`
          )
        );
      }
    }
    return findings;
  },
});

module.exports = check;
if (require.main === module) runAsCli(check);
