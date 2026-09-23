#!/usr/bin/env node
'use strict';

// Mirrors the current, tagged, clean working tree to the public repo
// (Domek-Labs/stagecrew-oss by default) as exactly one new commit on top of
// the public repo's existing history: no history transfer, no rebase, no
// merge. Decision + rationale: docs/adr/0027-public-release-mirror.md.
//
//   node ops/release-mirror.js [--dry-run] [--tag <name>] [--target <owner/repo>] [--branch <name>] [--remote-url <url>]
//
// --remote-url overrides the constructed `https://github.com/<target>.git`
// URL outright (e.g. a local bare repo path for testing this script itself);
// --target still names the repo in log/report output when --remote-url is set.
//
// Four refusals, evaluated in this order, BEFORE any network access:
//   1. dirty working tree
//   2. HEAD is not the tagged commit being released
//   3. checks/release-denylist.json is missing, or (real run only) still has
//      unfilled `pending` entries
//   4. the denylist scan (checks/check-7-release-scan.js) exits non-zero
//
// Refusals apply identically in --dry-run and in a real run: --dry-run only
// changes what happens once every refusal has already passed (see "Dry run
// vs. real run" below). A `pending`-entries refusal is the one exception:
// --dry-run only warns about it, a real run refuses (see checkPendingEntries).
//
// The scan is invoked, never reimplemented: this file spawns
// checks/check-7-release-scan.js as a child process and reads its exit code.
//
// The push credential is read from process.env.RELEASE_MIRROR_TOKEN — see
// .env.example for the documented (empty) placeholder. It is never printed,
// never placed on a child-process argv (visible via /proc/<pid>/cmdline /
// `ps`), and never interpolated into a URL. Instead it is handed to `git`
// through a throwaway GIT_ASKPASS script that reads it out of its own
// environment — the standard mechanism CI systems use for exactly this
// reason. The same handoff covers every network call this script makes
// against the (private) target repo: the read-only `git ls-remote` used to
// report/know the public HEAD, the `git fetch` that pulls that commit into
// this repo's local object store, and the final `git push`.
//
// Why the fetch exists: `git commit-tree -p <parent>` requires the parent
// commit object to already be present in the LOCAL object database — the
// private repo never otherwise holds any commit from the public repo. A real
// run therefore fetches the public HEAD (into a throwaway ref, deleted right
// after) and verifies it resolves to the exact sha `git ls-remote` reported,
// before building the commit object. The fetch is a full fetch, not a
// shallow one (no `--depth`), so this checkout never becomes a shallow
// repository as a side effect of running this script. --dry-run never does
// this: it never calls `commit-tree`, so it never needs the parent locally.
//
// The public commit's author/committer identity is read from AGENTS.md's
// `work-issue.commit_identity` at run time (via checks/lib/yaml.js, the same
// hand-rolled parser the structural checks use) rather than the ambient `git
// config` — see loadCommitIdentity() below.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseFrontmatter } = require('../checks/lib/yaml');

const REPO_ROOT = path.resolve(__dirname, '..');
const DENYLIST_DATA_FILE = 'checks/release-denylist.json';
const SCAN_CHECK_FILE = path.join(REPO_ROOT, 'checks', 'check-7-release-scan.js');
const DEFAULT_TARGET = 'Domek-Labs/stagecrew-oss';
const DEFAULT_BRANCH = 'main';
const TOKEN_ENV_VAR = 'RELEASE_MIRROR_TOKEN';

// Never publish the file that names what must never be published (see
// checks/release-denylist.json's own `_purpose` and the ADR). Extend this list
// if a future exclusion is needed; it stays short and explicit on purpose —
// an unbounded "exclude everything sensitive-looking" rule would be exactly
// the kind of judgement call this repo's structural-check philosophy avoids.
// The history sweep audits the private development history (its commit count,
// its pre-release state) — a record of that repo, not of the published one.
const EXCLUDE_FROM_MIRROR = [DENYLIST_DATA_FILE, 'docs/audit/git-history-secret-sweep-2026-06-28.md'];

// Thrown by fail() instead of calling process.exit() directly, so every
// try/finally already in this file (temp index cleanup, askpass-script
// cleanup) actually runs on a refusal — process.exit() would skip past them.
// Caught exactly once, in runMain().
class Refusal extends Error {}

function parseArgs(argv) {
  const args = {
    dryRun: false, tag: null, target: DEFAULT_TARGET, branch: DEFAULT_BRANCH, remoteUrl: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--tag') args.tag = argv[++i];
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '--remote-url') args.remoteUrl = argv[++i];
    else fail(`unrecognized argument \`${a}\``);
  }
  return args;
}

function fail(message) {
  throw new Refusal(message);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...opts,
  });
  return result;
}

function git(args, opts = {}) {
  return run('git', args, opts);
}

function remoteUrl(args) {
  return args.remoteUrl || `https://github.com/${args.target}.git`;
}

// --- Refusal 1: dirty working tree -----------------------------------------

function checkCleanTree() {
  const result = git(['status', '--porcelain']);
  if (result.status !== 0) {
    fail(`could not read working-tree status (git exited ${result.status}): ${result.stderr.trim()}`);
  }
  if (result.stdout.trim() !== '') {
    fail(`working tree is dirty (git status --porcelain):\n${result.stdout}`);
  }
}

// --- Refusal 2: HEAD is not the tagged commit being released ---------------

function checkTaggedHead(tagArg) {
  const head = git(['rev-parse', 'HEAD']);
  if (head.status !== 0) fail(`could not resolve HEAD: ${head.stderr.trim()}`);
  const headSha = head.stdout.trim();

  if (tagArg) {
    const tagSha = git(['rev-parse', '--verify', `refs/tags/${tagArg}^{commit}`]);
    if (tagSha.status !== 0) {
      fail(`--tag \`${tagArg}\` does not exist (git rev-parse --verify refs/tags/${tagArg}^{commit} failed)`);
    }
    if (tagSha.stdout.trim() !== headSha) {
      fail(`--tag \`${tagArg}\` does not point at HEAD (tag: ${tagSha.stdout.trim()}, HEAD: ${headSha})`);
    }
    return { tag: tagArg, sha: headSha };
  }

  const described = git(['describe', '--exact-match', '--tags', 'HEAD']);
  if (described.status !== 0) {
    fail(
      'HEAD is not a tagged commit (git describe --exact-match --tags HEAD failed): ' +
        `${described.stderr.trim() || 'no tag points at HEAD'}`
    );
  }
  return { tag: described.stdout.trim(), sha: headSha };
}

// --- Refusal 3: the denylist data file — present, and (real runs) filled ---

function loadDenylistFile() {
  const full = path.join(REPO_ROOT, DENYLIST_DATA_FILE);
  if (!fs.existsSync(full)) return { present: false };
  try {
    return { present: true, data: JSON.parse(fs.readFileSync(full, 'utf8')) };
  } catch (err) {
    // Malformed JSON is refused explicitly (below) rather than left to crash
    // as an uncaught SyntaxError — the same "throw a typed Refusal, never
    // exit past a finally block" discipline this file applies everywhere
    // else, and the same distinction checkDenylistScan() draws between "the
    // check found something" and "the check itself is broken".
    return { present: true, data: null, parseError: err };
  }
}

function checkDenylistPresent() {
  const loaded = loadDenylistFile();
  if (!loaded.present) {
    fail(
      `the release-denylist data file (${DENYLIST_DATA_FILE}) is missing — refusing without it, since ` +
        'nothing would be excluded from the scan or from the mirrored tree (see ' +
        'docs/adr/0027-public-release-mirror.md, decision 6)'
    );
  }
  if (loaded.parseError) {
    fail(`${DENYLIST_DATA_FILE} is present but not valid JSON: ${loaded.parseError.message}`);
  }
  return loaded.data;
}

// A real push refuses while the data file still names unfilled `pending`
// entries (docs/adr/0027-public-release-mirror.md, decision 6: they "should
// be filled in first"). --dry-run only warns, since a dry run publishes
// nothing and reading the warning is exactly how an operator finds out.
function checkPendingEntries(denylist, dryRun) {
  const pending = denylist.pending || [];
  if (pending.length === 0) return;
  const names = pending.map((p) => p.id).join(', ');
  if (dryRun) {
    console.error(
      `release-mirror: WARNING — ${DENYLIST_DATA_FILE} has unfilled \`pending\` entries (${names}); ` +
        'a real (non-dry-run) push refuses until they are filled in'
    );
    return;
  }
  fail(
    `${DENYLIST_DATA_FILE} has unfilled \`pending\` entries (${names}) — fill in their real values before ` +
      'a real push (see docs/adr/0027-public-release-mirror.md, decision 6); --dry-run only warns on this'
  );
}

// --- Refusal 4: the denylist scan -------------------------------------------

// Three distinct outcomes, each with its own message: matches found (exit 1),
// the check itself failed to run correctly (any other non-zero exit, e.g. 2
// for a thrown self-test), and a spawn failure or signal (the process never
// produced an exit code at all). Refusing is correct in all three cases; only
// the reason differs.
function checkDenylistScan() {
  const result = run(process.execPath, [SCAN_CHECK_FILE]);
  if (result.error) {
    fail(`could not start the denylist scan (checks/check-7-release-scan.js): ${result.error.message}`);
  }
  if (result.status === null) {
    fail(
      `the denylist scan (checks/check-7-release-scan.js) did not exit normally` +
        (result.signal ? ` (terminated by signal ${result.signal})` : '') +
        `:\n${result.stdout}${result.stderr}`
    );
  }
  if (result.status === 1) {
    fail(
      `the denylist scan found matches (checks/check-7-release-scan.js exited 1):\n${result.stdout}${result.stderr}`
    );
  }
  if (result.status !== 0) {
    fail(
      'the denylist scan itself failed to run correctly ' +
        `(checks/check-7-release-scan.js exited ${result.status}):\n${result.stdout}${result.stderr}`
    );
  }
}

// --- The tree to publish ----------------------------------------------------

// Every git-tracked file, minus the exclusions. `git ls-files` is used rather
// than a manual walk so .gitignore-style exclusions already in effect for
// this repo are honored automatically.
function mirroredFileList() {
  const result = git(['ls-files']);
  if (result.status !== 0) fail(`could not list tracked files: ${result.stderr.trim()}`);
  return result.stdout
    .split('\n')
    .filter((line) => line.length > 0)
    .filter((relPath) => !EXCLUDE_FROM_MIRROR.includes(relPath));
}

// Builds a git tree object for exactly the mirrored file list, using a
// throwaway index so the repo's real index is never touched. Local object
// writes only — no network access. The finally block runs on every exit path,
// including a fail() thrown inside this function or a thrown error from git
// itself, because fail() throws rather than calling process.exit().
//
// `files` (the caller's already-computed mirroredFileList() result, which is
// `git ls-files` minus EXCLUDE_FROM_MIRROR) is not just an input to seed the
// index from — it is also the expected final tree listing, and this function
// asserts the two match after write-tree, catching any drift between "what
// we meant to publish" and "what got written" before it ever reaches
// commit-tree.
function buildMirrorTree(files) {
  const tmpIndex = path.join(os.tmpdir(), `release-mirror-index-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  try {
    const readTree = git(['read-tree', 'HEAD'], { env });
    if (readTree.status !== 0) fail(`could not seed the mirror index from HEAD: ${readTree.stderr.trim()}`);

    for (const relPath of EXCLUDE_FROM_MIRROR) {
      // --force-remove is a no-op (not an error) if the path was never in the
      // index, which matters once the data file itself is excluded from the
      // repo's own commits some day. Its exit status is still checked: a
      // failure here (as opposed to a no-op) means the single most sensitive
      // invariant this function has — the excluded paths are gone from the
      // tree — cannot be trusted, so this must fail loudly rather than write
      // a tree that might still carry the data file.
      const forceRemove = git(['update-index', '--force-remove', relPath], { env });
      if (forceRemove.status !== 0) {
        fail(`could not remove ${relPath} from the mirror index: ${forceRemove.stderr.trim()}`);
      }
    }

    const writeTree = git(['write-tree'], { env });
    if (writeTree.status !== 0) fail(`could not write the mirror tree object: ${writeTree.stderr.trim()}`);
    const tree = writeTree.stdout.trim();

    const lsTree = git(['ls-tree', '-r', '--name-only', tree], { env });
    if (lsTree.status !== 0) fail(`could not read back the mirror tree object: ${lsTree.stderr.trim()}`);
    const actual = lsTree.stdout.split('\n').filter((line) => line.length > 0).slice().sort();
    const expected = files.slice().sort();
    if (actual.length !== expected.length || actual.some((line, i) => line !== expected[i])) {
      fail(
        'the mirror tree does not match the expected mirrored file list (expected ' +
          `${expected.length} files, tree has ${actual.length}) — refusing rather than publishing a tree ` +
          'that might still carry an excluded file or be missing a tracked one'
      );
    }

    return tree;
  } finally {
    fs.rmSync(tmpIndex, { force: true });
  }
}

// --- GIT_ASKPASS credential handoff -----------------------------------------
//
// The token never appears on a child-process argv and is never printed. git
// invokes this script for both the username and password prompts an https
// call triggers; the script tells the two apart from the prompt text git
// passes as argv[2] and reads the actual token out of its OWN environment
// (RELEASE_MIRROR_TOKEN), which this script (not git, not any log) sets.
function writeAskpassScript(tokenEnvVar) {
  const scriptPath = path.join(os.tmpdir(), `release-mirror-askpass-${process.pid}-${Date.now()}.sh`);
  const script = [
    '#!/bin/sh',
    'case "$1" in',
    '  *sername*) printf %s "x-access-token" ;;',
    `  *) printf %s "$${tokenEnvVar}" ;;`,
    'esac',
    '',
  ].join('\n');
  fs.writeFileSync(scriptPath, script, { mode: 0o700 });
  return scriptPath;
}

// Runs `fn(env)` with a fresh, throwaway askpass script wired up for `token`,
// and removes the script again before returning — on every exit path,
// including fn() throwing, since the cleanup lives in `finally`. Used for
// every network call this script makes: ls-remote, fetch, push.
function withAskpass(token, fn) {
  const askpassScript = writeAskpassScript(TOKEN_ENV_VAR);
  try {
    const env = {
      ...process.env,
      GIT_ASKPASS: askpassScript,
      GIT_TERMINAL_PROMPT: '0',
      [TOKEN_ENV_VAR]: token,
    };
    return fn(env);
  } finally {
    fs.rmSync(askpassScript, { force: true });
  }
}

// --- Public-repo HEAD (the prospective commit's parent) --------------------

// Read-only network call: safe in --dry-run. Degrades to null (never throws)
// so a dry run without network access — or without a token, which is optional
// for a dry run — still reports what it can rather than failing outright. A
// real run treats a failure here as fatal (see push()). When a token IS
// available (env var set), it is used here too: the target repo is private,
// so an unauthenticated read against it fails the same way an unauthenticated
// push would, dry run or not.
function publicHeadSha(url, branch, token) {
  const args = ['ls-remote', url, `refs/heads/${branch}`];
  const result = token
    ? withAskpass(token, (env) => run('git', args, { env }))
    : run('git', args, { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.status !== 0 || result.stdout.trim() === '') return null;
  return result.stdout.trim().split(/\s+/)[0];
}

// Fetches the public HEAD commit into this repo's local object store (a
// throwaway ref, deleted again in `finally`) so `git commit-tree -p` below
// has a parent object to point at, and verifies the fetched sha matches what
// `git ls-remote` reported a moment earlier — refusing rather than guessing
// if the remote moved in between. Real-run only: --dry-run never calls
// commit-tree, so it never needs the parent object locally.
function fetchKnownParent(url, branch, token, knownParent) {
  const tmpRef = `refs/release-mirror/fetch-${process.pid}-${Date.now()}`;
  const fetchArgs = ['fetch', '--no-tags', url, `refs/heads/${branch}:${tmpRef}`];
  const result = token
    ? withAskpass(token, (env) => git(fetchArgs, { env }))
    : git(fetchArgs, { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.status !== 0) {
    fail(
      `could not fetch ${url}@${branch} to bring the public parent commit into the local object store ` +
        `(git fetch exited ${result.status}): ${result.stderr.trim()}`
    );
  }
  try {
    const resolved = git(['rev-parse', tmpRef]);
    if (resolved.status !== 0 || resolved.stdout.trim() === '') {
      fail(`fetched ${url}@${branch} but could not resolve ${tmpRef} to a commit sha`);
    }
    const fetchedSha = resolved.stdout.trim();
    if (fetchedSha !== knownParent) {
      fail(
        `the fetched parent (${fetchedSha}) does not match the ls-remote-reported HEAD (${knownParent}) for ` +
          `${url}@${branch} — the remote moved between the two reads; refusing rather than guessing which is current`
      );
    }
    return fetchedSha;
  } finally {
    git(['update-ref', '-d', tmpRef]);
  }
}

function mirrorCommitMessage(tag) {
  const date = new Date().toISOString().slice(0, 10);
  return `release: mirror ${tag} (${date})`;
}

// Reads the public commit's author/committer identity from AGENTS.md's
// work-issue.commit_identity at run time, via the same hand-rolled YAML
// parser the structural checks use (checks/lib/yaml.js) — no second, hand-kept
// copy of the name/email in this file. Returns null when AGENTS.md is
// missing, unparseable, or the field is absent/incomplete; the caller refuses
// on null rather than falling back to the ambient `git config`, which could
// carry an employer address.
function loadCommitIdentity() {
  const agentsPath = path.join(REPO_ROOT, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) return null;
  let parsed;
  try {
    parsed = parseFrontmatter(fs.readFileSync(agentsPath, 'utf8'));
  } catch (err) {
    return null;
  }
  if (!parsed) return null;
  const identity = parsed.data && parsed.data['work-issue'] && parsed.data['work-issue'].commit_identity;
  if (!identity || typeof identity !== 'object' || !identity.name || !identity.email) return null;
  return { name: identity.name, email: identity.email };
}

function push(args, taggedHead) {
  const token = process.env[TOKEN_ENV_VAR];
  if (!token) {
    fail(
      `\`${TOKEN_ENV_VAR}\` is not set — the push credential is read from the environment, ` +
        'never from a committed file (see .env.example)'
    );
  }

  const url = remoteUrl(args);

  const knownParent = publicHeadSha(url, args.branch, token);
  if (!knownParent) {
    fail(
      `could not read the current HEAD of ${url}@${args.branch} (git ls-remote) — refusing to ` +
        'push without a known parent rather than guessing one'
    );
  }

  fetchKnownParent(url, args.branch, token, knownParent);

  const tree = buildMirrorTree(mirroredFileList());

  // Nothing changed since the last release: no-op rather than an empty commit.
  const parentTree = git(['rev-parse', `${knownParent}^{tree}`]);
  if (parentTree.status === 0 && parentTree.stdout.trim() === tree) {
    console.log(
      `release-mirror: nothing to publish — the release tree already matches ${url}@${args.branch}'s ` +
        'tree; no commit created'
    );
    return null;
  }

  const identity = loadCommitIdentity();
  if (!identity) {
    fail(
      "AGENTS.md's work-issue.commit_identity is not set (or AGENTS.md is missing/unparseable) — refusing " +
        'to author the public commit under an ambient git identity, which could carry an employer address'
    );
  }

  const commitTree = git(
    ['commit-tree', tree, '-p', knownParent, '-m', mirrorCommitMessage(taggedHead.tag)],
    {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: identity.name,
        GIT_AUTHOR_EMAIL: identity.email,
        GIT_COMMITTER_NAME: identity.name,
        GIT_COMMITTER_EMAIL: identity.email,
      },
    }
  );
  if (commitTree.status !== 0) fail(`could not build the mirror commit object: ${commitTree.stderr.trim()}`);
  const newCommitSha = commitTree.stdout.trim();

  const pushResult = withAskpass(token, (env) =>
    run('git', ['push', url, `${newCommitSha}:refs/heads/${args.branch}`], { env }));
  if (pushResult.status !== 0) {
    fail(`push to ${url}@${args.branch} failed: ${pushResult.stderr.trim()}`);
  }
  console.log(`release-mirror: pushed ${newCommitSha} to ${url}@${args.branch} (parent ${knownParent})`);
  return newCommitSha;
}

// --- Dry run -----------------------------------------------------------------

function dryRun(args, taggedHead) {
  const url = remoteUrl(args);
  const files = mirroredFileList();
  const tree = buildMirrorTree(files);
  const token = process.env[TOKEN_ENV_VAR] || null;
  const parent = publicHeadSha(url, args.branch, token);
  const message = mirrorCommitMessage(taggedHead.tag);

  console.log('release-mirror: --dry-run — no network write will be performed');
  console.log(`  target:            ${url}`);
  console.log(`  target branch:     ${args.branch}`);
  console.log(`  tag being mirrored: ${taggedHead.tag} (${taggedHead.sha})`);
  console.log('  prospective commit:');
  console.log(`    message: ${message}`);
  console.log(`    parent:  ${parent || 'unknown (no network / no credential)'}`);
  console.log(`    tree:    ${tree}`);
  console.log(`  file count: ${files.length}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Refusals run before any network access, in this fixed order, and apply
  // whether or not --dry-run was given (pending-entries is the one exception
  // — see checkPendingEntries).
  checkCleanTree();
  const taggedHead = checkTaggedHead(args.tag);
  const denylist = checkDenylistPresent();
  checkPendingEntries(denylist, args.dryRun);
  checkDenylistScan();

  if (args.dryRun) {
    dryRun(args, taggedHead);
    return;
  }

  push(args, taggedHead);
}

// The one catch in the file. fail() throws a Refusal instead of calling
// process.exit() specifically so this is reachable only after every
// try/finally between the throw site and here has already run.
function runMain() {
  try {
    main();
  } catch (err) {
    if (err instanceof Refusal) {
      console.error(`release-mirror: REFUSED — ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

runMain();
