'use strict';

// Check 1 — every field of the canonical `work-issue:` field set appears in the
// AGENTS.md template that /init-agents writes into downstream repos.
//
// Canonical source: the field-completeness enumeration in
// skills/work-issue/SKILL.md. That enumeration is the authority because the
// /work-issue pre-flight *executes* it: a repo whose AGENTS.md is missing one of
// those keys is STOPped. The check reads the sentence and extracts the names; it
// carries no field list of its own, so renaming or adding a field in the
// canonical enumeration changes what this check requires, with no edit here.

const { defineCheck, finding, read, runAsCli } = require('./lib/check');

const CANONICAL = 'skills/work-issue/SKILL.md';
const TEMPLATE = 'skills/init-agents/references/AGENTS.md.template';

// "all 11 fields in the `work-issue:` namespace are set (`a`, `b`, ...)"
const MANDATORY_SENTENCE = /all\s+(\d+)\s+fields\s+in\s+the\s+`work-issue:`\s+namespace\s+are\s+set\s*\(([^)]*)\)/i;
// "**`docs_command` is OPTIONAL**"
const OPTIONAL_SENTENCE = /\*\*`([A-Za-z_][A-Za-z0-9_]*):?`\s+is\s+OPTIONAL\*\*/g;

function backtickedNames(text) {
  return [...text.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]);
}

function lineOf(text, needle) {
  const upTo = text.indexOf(needle);
  if (upTo === -1) return null;
  return text.slice(0, upTo).split('\n').length;
}

// The canonical field set, read out of the enumeration rather than declared here.
function canonicalFieldSet(skill) {
  const mandatoryMatch = skill.match(MANDATORY_SENTENCE);
  if (!mandatoryMatch) {
    throw new Error(
      `the field-completeness enumeration was not found in ${CANONICAL}; ` +
        'if it moved or was reworded, point this check at its new home rather than copying the list'
    );
  }
  const mandatory = backtickedNames(mandatoryMatch[2]);
  const declaredCount = Number(mandatoryMatch[1]);
  const optional = [...skill.matchAll(OPTIONAL_SENTENCE)].map((m) => m[1]);
  return {
    mandatory,
    declaredCount,
    optional: [...new Set(optional)],
    sentence: mandatoryMatch[0],
  };
}

// A field "appears" in the template when a line declares it as a key — live, or
// commented out. AGENTS.md hard gate 8 names the commented `models:` block in
// this very template as one of four *deliberate* copy artifacts, so a commented
// optional block is the documented shape, not a defect: requiring a live YAML key
// would contradict the repo's own canonical rule. Decision recorded in
// docs/adr/0015-structural-check-layer.md.
function templateDeclares(templateLines, field, range) {
  const pattern = new RegExp(`^\\s*(#\\s*)?${field}\\s*:`);
  for (let i = range.start; i < range.end; i++) {
    if (pattern.test(templateLines[i])) return i + 1;
  }
  return null;
}

// The `work-issue:` block, as a line range. This check's title claims the field is
// in that namespace, so the scan has to be bounded by it: an unbounded scan passes
// when a mandatory field is moved into another namespace — exactly what the
// /work-issue pre-flight would STOP on.
//
// The block runs from the `work-issue:` key to the first following line at column 0
// — a top-level key, or a column-0 comment, which is how this template separates its
// namespaces. Comments *inside* the block are indented with the keys they document,
// so that boundary is where the block actually ends. It also fails the safe way: a
// column-0 comment added inside the block shortens the range and turns this check
// RED, never silently green.
function namespaceRange(templateLines) {
  const start = templateLines.findIndex((l) => /^work-issue\s*:/.test(l));
  if (start === -1) {
    throw new Error(
      `no \`work-issue:\` block found in ${TEMPLATE}; if the namespace was renamed, ` +
        'point this check at its new name rather than widening the scan'
    );
  }
  let end = templateLines.length;
  for (let i = start + 1; i < templateLines.length; i++) {
    const line = templateLines[i];
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) {
      end = i;
      break;
    }
  }
  return { start: start + 1, end, line: start + 1 };
}

const check = defineCheck({
  id: 1,
  title: 'every canonical `work-issue:` field appears in the AGENTS.md template',
  canonical: `${CANONICAL} (field-completeness enumeration) → ${TEMPLATE}`,
  run() {
    const skill = read(CANONICAL);
    const set = canonicalFieldSet(skill);
    const findings = [];
    const sentenceLine = lineOf(skill, set.sentence);

    if (set.mandatory.length !== set.declaredCount) {
      findings.push(
        finding(
          CANONICAL,
          sentenceLine,
          `the enumeration says ${set.declaredCount} fields but names ${set.mandatory.length}: ` +
            set.mandatory.join(', ')
        )
      );
    }

    const templateLines = read(TEMPLATE).split('\n');
    // The scan is bounded to the `work-issue:` block. Where a missing field would
    // have to be added — a missing key has no line of its own, so the finding points
    // at the block it belongs in.
    const range = namespaceRange(templateLines);
    const namespaceLine = range.line;
    for (const field of [...set.mandatory, ...set.optional]) {
      const kind = set.mandatory.includes(field) ? 'mandatory' : 'optional';
      if (templateDeclares(templateLines, field, range) === null) {
        findings.push(
          finding(
            TEMPLATE,
            namespaceLine,
            `${kind} field \`${field}\` is declared nowhere in the \`work-issue:\` block ` +
              `(required by the field set in ${CANONICAL}:${sentenceLine})`
          )
        );
      }
    }
    return findings;
  },
});

module.exports = check;
if (require.main === module) runAsCli(check);
