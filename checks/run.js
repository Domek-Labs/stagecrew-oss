#!/usr/bin/env node
'use strict';

// The one entrypoint. Both invocation sites — the `syntax_check` field in
// AGENTS.md and the GitHub Actions workflow — run exactly this and nothing else,
// so neither carries a list of checks that could drift away from the other.
//
// Checks are discovered from disk: every `check-*.js` beside this file. Adding a
// check therefore needs no edit here, in AGENTS.md, or in the workflow.
//
// Exit code: 0 = no findings, 1 = findings, 2 = a check itself broke.

const fs = require('fs');
const path = require('path');
const { runCheck, reportCheck, REPO_ROOT } = require('./lib/check');

function discover() {
  return fs
    .readdirSync(__dirname)
    .filter((name) => /^check-\d+-.*\.js$/.test(name))
    .sort((a, b) => Number(a.match(/^check-(\d+)/)[1]) - Number(b.match(/^check-(\d+)/)[1]))
    .map((name) => require(path.join(__dirname, name)));
}

function main() {
  const started = Date.now();
  const checks = discover();
  if (checks.length === 0) {
    console.error('no checks were discovered — checks/ is empty or the naming convention changed');
    process.exit(2);
  }

  console.log(`stagecrew structural checks — ${REPO_ROOT}`);
  console.log('');

  let findingCount = 0;
  let failedChecks = 0;
  let brokenChecks = 0;

  for (const check of checks) {
    const result = runCheck(check);
    reportCheck(check, result);
    if (result.error) brokenChecks++;
    else if (result.findings.length > 0) {
      failedChecks++;
      findingCount += result.findings.length;
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  console.log('');
  console.log(
    `${checks.length} checks run in ${seconds}s — ` +
      `${findingCount} finding(s) in ${failedChecks} check(s)` +
      (brokenChecks > 0 ? `, ${brokenChecks} check(s) broke` : '')
  );

  if (brokenChecks > 0) process.exit(2);
  process.exit(findingCount === 0 ? 0 : 1);
}

main();
