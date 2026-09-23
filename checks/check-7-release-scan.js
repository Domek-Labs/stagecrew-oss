'use strict';

// Check 7 — the tree carries none of the patterns declared in the release
// denylist (checks/release-denylist.json): private filesystem paths, an
// employer/client codename fragment, and credential-shaped strings.
//
// Canonical source: checks/release-denylist.json. This check carries no pattern
// of its own — it reads the data file at run time, the same "derive, do not
// copy" rule every other check in this layer follows (CONTRIBUTING.md, "What
// each check derives from"). Extending the denylist is a data-file edit, never
// a code edit here.
//
// Scan set: `git ls-files` — the same tracked-file set
// ops/release-mirror.js's mirroredFileList() publishes (minus the same
// excluded denylist data file on both sides), not a disk walk against a fixed
// extension list. That equivalence is deliberate: a file the mirror publishes
// is a file this check has scanned, and vice versa, with no third list of
// extensions to keep in sync with either. See
// docs/adr/0027-public-release-mirror.md, decision 8.
//
// A tracked file is treated as text unless its content contains a NUL byte —
// checked on the raw bytes, before any UTF-8 decoding — in which case it is
// skipped as binary and the skip is noted in the output. When `git` is
// unavailable or this is not a git checkout at all (e.g. a tarball extraction
// with no `.git`), the scan falls back to a disk walk over a fixed
// text-extension list (checks/lib/check.js walkTextFiles()) and says so in the
// output — a tracked file whose extension is not on that list would not be
// scanned in this fallback mode.
//
// Why this check exists, and why the data file it reads is excluded both from
// this check's own scan set and from the tree ops/release-mirror.js pushes:
// docs/adr/0027-public-release-mirror.md.
//
// Documented-literal vs. real-token-shaped, and why a regex naming a credential
// shape does not itself match its own quoted source: see "Self-test" below and
// the ADR's denylist-exclusion decision.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const {
  defineCheck, finding, exists, read, walkTextFiles, runAsCli, REPO_ROOT,
} = require('./lib/check');

const DENYLIST_PATH = 'checks/release-denylist.json';

function loadDenylist() {
  if (!exists(DENYLIST_PATH)) return null;
  return JSON.parse(read(DENYLIST_PATH));
}

function escapeLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A pattern opts into a left word-boundary via `"boundary": "left"` in the
// data file, applied at compile time rather than baked into the stored
// `value` — `value` stays exactly the bare text a doc would quote (what
// allowedLiterals() masks and what the self-test derives its fixtures from),
// while the compiled regex actually used for scanning is stricter.
const LEFT_BOUNDARY = '(?<![A-Za-z0-9_-])';

function withBoundary(patternSource, entry) {
  return entry.boundary === 'left' ? `${LEFT_BOUNDARY}${patternSource}` : patternSource;
}

// A credential pattern's own regex *source* is, by construction, an allowed
// literal: it is exactly the text a doc quotes when it documents the shape
// (e.g. "ghp_[A-Za-z0-9]{30,}" in skills/work-issue/SKILL.md). Deriving the
// allow-list from the credential list itself — rather than hand-maintaining a
// second copy in the data file — means the two can never drift apart. The
// data file's own (currently empty) `allow` array is for anything beyond that:
// a documented example that quotes a pattern in a different shape than its
// exact regex source.
function allowedLiterals(denylist) {
  const fromCredentials = denylist.credentials.map((c) => c.value);
  const fromAllowList = (denylist.allow || []).map((a) => a.value);
  return [...fromCredentials, ...fromAllowList];
}

// Masks every allow-listed literal out of a line before the credential regexes
// run against it, so a doc line that quotes a pattern's own source verbatim
// cannot be mistaken for an occurrence of that pattern — while a real secret
// elsewhere on the same line is still caught. The mask character is NUL,
// built via String.fromCharCode rather than written as a literal control
// byte in this source file (which would make the file itself look binary to
// `grep` and to GitHub's diff viewer, and would trip this very check's own
// binary-detection rule below). No credential character class in this file
// matches it, and the mask is the same length as what it replaces, so
// reported column positions stay meaningful.
const MASK_CHAR = String.fromCharCode(0);

function maskAllowed(line, allowed) {
  let masked = line;
  for (const literal of allowed) {
    if (literal.length === 0) continue;
    masked = masked.split(literal).join(MASK_CHAR.repeat(literal.length));
  }
  return masked;
}

function compileLiteral(entry) {
  return { ...entry, regex: new RegExp(withBoundary(escapeLiteral(entry.value), entry), 'g') };
}

function compileRegex(entry) {
  return { ...entry, regex: new RegExp(withBoundary(entry.value, entry), 'g') };
}

// --- Self-test -------------------------------------------------------------
//
// Runs on every invocation, independent of the tree being scanned. It proves
// the one property the false-positive AC depends on: a credential regex
// matches a real, token-shaped value but does not match its own documented
// regex-source text quoted as prose. The fake tokens are built by string
// concatenation at run time, never written as a literal token-shaped value in
// this file — a literal fake here would itself be a token-shaped string this
// check (and the Implementer's own pre-commit secret scan) would have to
// treat as a real finding.
//
// The "documented literal" half of each fixture is NOT hand-copied here: it
// is read straight off the compiled pattern's own `.value` (the data file),
// so a pattern edited in checks/release-denylist.json can never drift out of
// sync with what this self-test proves against. Only the fake-token generator
// — which has no data-file counterpart, since a real token never lives there
// — stays hand-written, one per credential shape currently in the seed list.
//
// Representative, not exhaustive: a new credential shape added to the
// denylist without a matching fixture entry here is not self-tested — a known
// gap, recorded in docs/adr/0027-public-release-mirror.md (decision 5).
const SELF_TEST_FIXTURES = [
  { id: 'github-classic-pat', fakeToken: () => 'ghp_' + 'A'.repeat(36) },
  { id: 'github-fine-grained-pat', fakeToken: () => 'github_pat_' + 'B'.repeat(25) },
  { id: 'generic-sk-key', fakeToken: () => 'sk-' + 'D'.repeat(25) },
  { id: 'slack-bot-token', fakeToken: () => 'xoxb-' + 'E'.repeat(20) },
  { id: 'pem-private-key-header', fakeToken: () => '-----BEGIN' + ' RSA' + ' PRIVATE KEY-----' },
];

// Throws (the runner reports this as a broken check, exit 2) rather than
// returning a finding: a self-test failure means this check can no longer
// prove it distinguishes documentation from a real secret, which is a defect
// in the check, not a finding about the repo.
function selfTest(credentialPatterns) {
  const byId = new Map(credentialPatterns.map((c) => [c.id, c]));
  for (const fixture of SELF_TEST_FIXTURES) {
    const pattern = byId.get(fixture.id);
    if (!pattern) continue; // seed list changed; nothing to self-test against
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(pattern.value)) {
      throw new Error(
        `self-test failed for credential pattern \`${fixture.id}\`: the regex matched its own ` +
          'documented literal source (checks/release-denylist.json\'s own `value`) — it can no ' +
          'longer be quoted as documentation without tripping this check'
      );
    }
    pattern.regex.lastIndex = 0;
    if (!pattern.regex.test(fixture.fakeToken())) {
      throw new Error(
        `self-test failed for credential pattern \`${fixture.id}\`: the regex did not match a ` +
          'realistic token-shaped fake — it would silently miss a real secret of this shape'
      );
    }
  }
}

// --- Scan set ----------------------------------------------------------------

// Every git-tracked file, relative to the repo root — the same set
// ops/release-mirror.js's mirroredFileList() publishes. Returns null (never
// throws) when `git` is unavailable or this is not a git checkout at all, so
// the caller can fall back rather than treat either as a scan failure.
function gitLsFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.split('\n').filter((line) => line.length > 0);
}

// A file is text unless its raw content contains a NUL byte, checked before
// any UTF-8 decoding (a NUL byte is itself valid single-byte UTF-8, so
// checking the decoded string would work too, but the raw buffer is the more
// direct reading of "no NUL byte"). Returns null for a file that cannot be
// read at all (e.g. a path git tracks as a gitlink/submodule with nothing on
// disk) rather than throwing — a check should not break on a shape of entry
// it was never asked to scan.
//
// A tracked symlink is a special case, checked first via `lstat` (never
// `stat`, which would follow it): the mirror publishes the link itself — a
// blob whose content is the target path string, exactly what `git` stores
// for a symlink in its index/tree — never the file the link happens to
// resolve to on this disk. So the "content" scanned for a symlink entry is
// `readlink`'s target-path string, treated as a single line, and the link is
// never followed. This keeps the scan set equal to the published set (the
// property decision 8 of docs/adr/0027-public-release-mirror.md and the
// CLAUDE.md check-7 paragraph describe): a symlink whose target path itself
// matches a denylisted path pattern is caught here; the file it points at,
// if that file is separately tracked, is scanned as its own entry by this
// same loop — never by following this link.
function readIfText(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  let lst;
  try {
    lst = fs.lstatSync(fullPath);
  } catch (err) {
    return null;
  }
  if (lst.isSymbolicLink()) {
    try {
      return fs.readlinkSync(fullPath);
    } catch (err) {
      return null;
    }
  }
  let raw;
  try {
    raw = fs.readFileSync(fullPath);
  } catch (err) {
    return null;
  }
  if (raw.includes(0)) return undefined; // sentinel: binary, distinct from "unreadable"
  return raw.toString('utf8');
}

const check = defineCheck({
  id: 7,
  title: 'the tree carries none of the private-path / credential-shaped patterns in the release denylist',
  canonical: `${DENYLIST_PATH}`,
  run() {
    const denylist = loadDenylist();

    // Absent data file — by design, not by accident, in the published mirror
    // (the mirror excludes this file from the tree it pushes; see the ADR).
    // Resolving "nothing to scan for" as a trivial pass, rather than an error,
    // is the deliberate choice: the alternative (fail closed) would mean this
    // check permanently breaks CI in the public mirror the day its workflow is
    // restored, for a file that is absent by design there, not by mistake.
    // Cost accepted: this check also cannot tell an intentionally-absent file
    // apart from an accidentally-deleted one in THIS repo — a deletion here
    // would pass silently too. checks/run.js still reports every check that
    // ran, so a silently-passing check 7 is visible in the run output, just
    // not distinguishable from "correctly nothing to check" without reading
    // the tree by hand. Recorded in docs/adr/0027-public-release-mirror.md.
    // (ops/release-mirror.js itself refuses outright on an absent data file —
    // see its checkDenylistPresent() — this fail-open reading is for the
    // check alone, e.g. the eventual public-repo CI run.)
    if (!denylist) return [];

    const pathPatterns = (denylist.paths || []).map(compileLiteral);
    const credentialPatterns = (denylist.credentials || []).map(compileRegex);
    selfTest(credentialPatterns);

    const allowed = allowedLiterals(denylist);
    const findings = [];

    let files = gitLsFiles();
    if (files === null) {
      console.error(
        'check 7: `git ls-files` unavailable (not a git checkout, or git is missing) — falling back to a ' +
          'disk walk over a fixed text-extension list (checks/lib/check.js walkTextFiles); a tracked file ' +
          'whose extension is not in that list would not be scanned in this fallback mode'
      );
      files = walkTextFiles();
    }

    let skippedBinaryCount = 0;
    for (const relPath of files) {
      if (relPath === DENYLIST_PATH) continue; // never scan the data that would leak its own contents
      const text = readIfText(relPath);
      if (text === null) continue; // unreadable (e.g. a gitlink with nothing on disk) — nothing to scan
      if (text === undefined) { skippedBinaryCount++; continue; } // binary (NUL byte) — skipped, noted below

      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        for (const p of pathPatterns) {
          p.regex.lastIndex = 0;
          if (p.regex.test(rawLine)) {
            findings.push(
              finding(relPath, i + 1, `matches release-denylist path entry \`${p.id}\` (${p.note})`)
            );
          }
        }
        const maskedLine = maskAllowed(rawLine, allowed);
        for (const c of credentialPatterns) {
          c.regex.lastIndex = 0;
          if (c.regex.test(maskedLine)) {
            findings.push(
              finding(
                relPath,
                i + 1,
                `matches release-denylist credential shape \`${c.id}\` (${c.note}) — value redacted from this report`
              )
            );
          }
        }
      }
    }

    if (skippedBinaryCount > 0) {
      console.error(`check 7: skipped ${skippedBinaryCount} binary file(s) (contains a NUL byte) — not scanned`);
    }

    return findings;
  },
});

module.exports = check;
if (require.main === module) runAsCli(check);
