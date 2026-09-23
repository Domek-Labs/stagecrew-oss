'use strict';

// Check 6 — the version manifest is internally consistent, and no other file in
// the repo names the version it currently carries.
//
// Canonical sources, both read at run time:
//   * AGENTS.md `version_policy` — names which file is the source of truth
//     (`source_of_truth`) and which versioning scheme it must satisfy (`scheme`).
//     Point the policy at a different file and this check follows it.
//   * that file itself — supplies the version string to search for. The check
//     carries no version and no version-shape regex of its own.
//
// Narrowed rule (issue #80, after a dry run): the original shape rule
// `v?\d+\.\d+\.\d+` produced nine findings and zero defects on a clean tree — it
// matched semver thresholds in the version policy's own prose (`1.0.0`) and a
// third-party tool version in an audit record (`gitleaks 8.16.0`). Searching for
// the *current* version instead asks the single question the rule actually cares
// about: does any file besides the manifest claim to know what version this is?
//
// Deliberate blind spot: a reference to a *stale* version ("v0.29.0 introduced
// X") is not caught. Telling a historical statement from a live claim needs
// judgement, and judgement is the line this layer does not cross.

const { defineCheck, finding, read, exists, walkTextFiles, runAsCli } = require('./lib/check');
const { parseFrontmatter } = require('./lib/yaml');

const POLICY_HOME = 'AGENTS.md';

const SCHEME_SHAPES = {
  semver: /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
};

function versionPolicy() {
  const parsed = parseFrontmatter(read(POLICY_HOME));
  const policy = parsed && parsed.data && parsed.data.version_policy;
  if (!policy || !policy.source_of_truth) {
    throw new Error(`no \`version_policy.source_of_truth\` in ${POLICY_HOME}; this check has nothing to derive from`);
  }
  return policy;
}

const check = defineCheck({
  id: 6,
  title: 'the version manifest is consistent and no other file names the current version',
  canonical: `${POLICY_HOME} \`version_policy\` → the manifest it names`,
  run() {
    const policy = versionPolicy();
    const manifestPath = policy.source_of_truth;
    const findings = [];

    if (!exists(manifestPath)) {
      return [finding(POLICY_HOME, null, `\`version_policy.source_of_truth\` names \`${manifestPath}\`, which does not exist`)];
    }

    let manifest;
    try {
      manifest = JSON.parse(read(manifestPath));
    } catch (err) {
      return [finding(manifestPath, null, `the version manifest is not valid JSON: ${err.message}`)];
    }

    if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
      findings.push(finding(manifestPath, null, 'the manifest declares no non-empty `name`'));
    }
    const version = manifest.version;
    if (typeof version !== 'string' || version.trim() === '') {
      findings.push(finding(manifestPath, null, 'the manifest declares no non-empty `version`'));
      return findings;
    }

    const shape = SCHEME_SHAPES[String(policy.scheme || '').toLowerCase()];
    if (!shape) {
      findings.push(
        finding(POLICY_HOME, null, `\`version_policy.scheme\` is \`${policy.scheme}\`, which this check cannot validate`)
      );
    } else if (!shape.test(version)) {
      findings.push(finding(manifestPath, null, `version \`${version}\` is not a valid ${policy.scheme} version`));
    }

    // No other file may name the version the manifest currently carries.
    const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Boundaries: the version must stand alone — it is not matched inside a longer
    // version string (a further leading or trailing component, or a pre-release
    // suffix). A sentence-final occurrence still counts: the trailing full stop is
    // punctuation, and the sentence is still a claim about the current version.
    const named = new RegExp(`(?<![0-9A-Za-z.-])v?${escaped}(?![0-9A-Za-z-])(?!\\.\\d)`);
    for (const relPath of walkTextFiles()) {
      if (relPath === manifestPath) continue;
      const lines = read(relPath).split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!named.test(lines[i])) continue;
        findings.push(
          finding(
            relPath,
            i + 1,
            `names the current version \`${version}\`, which only \`${manifestPath}\` may state ` +
              `(\`version_policy\` in ${POLICY_HOME})`
          )
        );
      }
    }
    return findings;
  },
});

module.exports = check;
if (require.main === module) runAsCli(check);
