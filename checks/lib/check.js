'use strict';

const path = require('path');
const fs = require('fs');

// The repository root, derived from this file's location. Every check resolves
// its inputs against it, so the layer behaves identically whatever the caller's
// working directory is (the loop runs `syntax_check` from the repo root, CI runs
// it from the workspace root, a developer may run it from anywhere).
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

function listDirectories(relPath) {
  return fs
    .readdirSync(path.join(REPO_ROOT, relPath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Every file tracked as text, relative to the repo root. `.git` and binary
// assets are skipped; no check needs them and reading them is pure cost.
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules']);
const TEXT_EXTENSIONS = new Set([
  '.md', '.json', '.yaml', '.yml', '.js', '.txt', '.example', '.template', '.sh', '',
]);

function walkTextFiles(relPath = '.') {
  const found = [];
  const walk = (current) => {
    const entries = fs.readdirSync(path.join(REPO_ROOT, current), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const next = current === '.' ? entry.name : `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        walk(next);
        continue;
      }
      if (!entry.isFile()) continue;
      const name = entry.name;
      const dot = name.lastIndexOf('.');
      const ext = dot <= 0 ? '' : name.slice(dot);
      if (!TEXT_EXTENSIONS.has(ext.toLowerCase())) continue;
      found.push(next);
    }
  };
  walk(relPath);
  return found;
}

// Every SKILL.md in the plugin, relative to the repo root.
function skillFiles() {
  return listDirectories('skills')
    .map((name) => `skills/${name}/SKILL.md`)
    .filter((relPath) => exists(relPath));
}

function finding(file, line, message) {
  return { file, line, message };
}

// A check is a plain object. `run` returns an array of findings; an empty array
// is a pass. A check never prints and never exits — the runner owns both, which
// is what lets the same check object be run alone or as part of the layer.
function defineCheck({ id, title, canonical, run }) {
  return { id, title, canonical, run };
}

function formatFinding(f) {
  const location = f.line === null || f.line === undefined ? f.file : `${f.file}:${f.line}`;
  return `    ${location}  ${f.message}`;
}

function runCheck(check) {
  try {
    return { findings: check.run(), error: null };
  } catch (err) {
    return { findings: [], error: err };
  }
}

function reportCheck(check, result) {
  const label = result.error ? 'ERROR' : result.findings.length === 0 ? ' PASS' : ' FAIL';
  console.log(`[${label}] check ${check.id} — ${check.title}`);
  console.log(`         canonical source: ${check.canonical}`);
  if (result.error) {
    console.log(`    the check itself failed: ${result.error.message}`);
    return;
  }
  for (const f of result.findings) console.log(formatFinding(f));
}

// Lets any check file be executed on its own: `node checks/check-4-....js`.
// Exit codes are the layer's, so a single check and the whole layer agree:
// 0 = no findings, 1 = findings, 2 = the check itself broke.
function runAsCli(check) {
  const result = runCheck(check);
  reportCheck(check, result);
  if (result.error) process.exit(2);
  process.exit(result.findings.length === 0 ? 0 : 1);
}

module.exports = {
  REPO_ROOT,
  read,
  exists,
  listDirectories,
  walkTextFiles,
  skillFiles,
  finding,
  defineCheck,
  runCheck,
  reportCheck,
  runAsCli,
};
