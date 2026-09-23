'use strict';

// Check 2 — every `references/...` path a SKILL.md mentions resolves to something
// that exists.
//
// Canonical source: the filesystem. The check invents no inventory of expected
// files; it takes the pointers the prose actually writes and asks the disk.
//
// Resolution rule (issue #80, narrowed after a dry run): a mention resolves
// relative to the directory of the SKILL.md that mentions it; failing that, it is
// looked up under every `skills/*/references/`. Only a path that resolves nowhere
// is a finding. The fallback exists because cross-skill pointers are a real and
// intended pattern here — skills/init-agents/SKILL.md points at
// `references/repo-registry.yaml.example`, whose file lives under
// skills/work-issue/references/ and whose parenthetical names the owning skill.
//
// A mention carrying a `<placeholder>` is a path *template*, not a path. For
// those the check asserts the containing directory exists, which is the strongest
// claim that can be made without expanding the placeholder.

const path = require('path');
const fs = require('fs');
const {
  defineCheck, finding, exists, listDirectories, skillFiles, REPO_ROOT, runAsCli,
} = require('./lib/check');

const MENTION = /references\/[A-Za-z0-9._<>*-]+(?:\/[A-Za-z0-9._<>*-]+)*/g;
const TRAILING_PUNCTUATION = /[.,;:)`'"]+$/;

function referenceRoots() {
  return listDirectories('skills')
    .map((skill) => `skills/${skill}/references`)
    .filter((relPath) => exists(relPath));
}

function existsAnyCase(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

function collectMentions(relPath, text) {
  const mentions = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(MENTION)) {
      let mention = match[0].replace(TRAILING_PUNCTUATION, '');
      if (mention.length === 0) continue;
      mentions.push({ file: relPath, line: i + 1, mention });
    }
  }
  return mentions;
}

function candidatesFor(mention, owningDir, roots) {
  const suffix = mention.slice('references/'.length);
  return [...new Set([`${owningDir}/${mention}`, ...roots.map((root) => `${root}/${suffix}`)])];
}

const check = defineCheck({
  id: 2,
  title: 'every `references/...` path a SKILL.md mentions exists on disk',
  canonical: 'the filesystem (skills/*/references/)',
  run() {
    const roots = referenceRoots();
    const findings = [];

    for (const skillFile of skillFiles()) {
      const owningDir = path.posix.dirname(skillFile);
      const text = fs.readFileSync(path.join(REPO_ROOT, skillFile), 'utf8');
      for (const { line, mention } of collectMentions(skillFile, text)) {
        const isTemplate = mention.includes('<') || mention.includes('*');
        const target = isTemplate ? path.posix.dirname(mention) : mention;
        if (target === 'references' && isTemplate) continue;
        const candidates = candidatesFor(target, owningDir, roots);
        if (candidates.some(existsAnyCase)) continue;
        findings.push(
          finding(
            skillFile,
            line,
            isTemplate
              ? `\`${mention}\` is a path template whose directory resolves nowhere (tried: ${candidates.join(', ')})`
              : `\`${mention}\` resolves nowhere (tried: ${candidates.join(', ')})`
          )
        );
      }
    }
    return findings;
  },
});

module.exports = check;
if (require.main === module) runAsCli(check);
