#!/usr/bin/env node
// THE ONE PIECE OF NODE IN AN OSY# APP: find the runtime and exec it, so `npm run dev` means what it means
// everywhere else. The scripts in package.json call this rather than a bare `osy`, because nothing installs the
// Osy# CLI onto PATH in the judging container — it is vendored beside the app.
//
// Resolution order, most explicit first:
//   1. $OSY_BIN                     — set it and this file gets out of the way
//   2. ../runtime/osy               — the vendored, self-contained binary (what a submission ships)
//   3. `osy` on PATH                — a developer machine with the CLI installed
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ⛔ WALK UP FOR IT — the app is NOT always one level below the runtime, and assuming it was cost a whole run.
//    Their runner copies `app-template/` to `output/app/` before Pi touches it (`prepareOutput`), so at judging
//    time the app sits TWO levels under the repo root while `runtime/` sits at the root. A fixed `../runtime/osy`
//    resolves to `output/runtime/osy`, which does not exist.
//    ⚑ MEASURED 2026-09-02 by running their own `npm run challenge` against the assembled submission: Pi built the
//      app fine (20 model calls, 29 tool calls) and then ALL THREE GATES died with the same line —
//      "Could not run the Osy# runtime (osy): spawn osy ENOENT ... Looked for: .../output/runtime/osy,
//      .../output/app/runtime/osy then `osy` on PATH." The image had been hiding it behind `ENV OSY_BIN`, so every
//      earlier measurement passed.
//    Walking up finds it wherever the app is nested, and stops at the filesystem root.
// ⚠ ARCHITECTURE IS NOT STATED BY THE ORGANIZERS. Their base image (`node:22.19.0-bookworm-slim`) is multi-arch
//    and nothing in their repo pins one, so a submission that vendors a compiled runtime cannot know whether the
//    judged host is x64 or arm64. Everything we ship is arch-specific: the binary, the PostgreSQL bundle, and the
//    pre-built cluster. So the layout carries the RID and this picks the one it is running on:
//
//      runtime/<rid>/osy · runtime/<rid>/pg/<tag>/ · runtime/<rid>/instance.tgz     ← preferred
//      runtime/osy       · runtime/pg/<tag>/       · runtime/instance.tgz           ← flat fallback
//
//    The names are .NET RIDs, so `dotnet publish -r linux-x64` lands in the directory that serves linux-x64.
const RID = `${{ darwin: 'osx', win32: 'win' }[process.platform] ?? process.platform}-${process.arch}`;

function runtimeRoots(from) {
  const roots = [];
  let dir = from;
  for (;;) {
    roots.push(join(dir, 'runtime', RID), join(dir, 'runtime'));
    const up = dirname(dir);
    if (up === dir) return roots;
    dir = up;
  }
}

// Anything vendored, found in the same order: every arch-qualified root before any flat one at that level.
const vendoredDir = (name) => runtimeRoots(here).map((r) => join(r, name)).find((p) => existsSync(p));

const candidates = [
  process.env.OSY_BIN,
  ...runtimeRoots(here).map((r) => join(r, 'osy')),
].filter(Boolean);

const found = candidates.find((c) => existsSync(c)) ?? 'osy';

// ── THE COLD START, AND WHY IT IS FATAL RATHER THAN SLOW ──────────────────────────────────────────────────────────
// Their verifier gives `npm run dev` TWENTY SECONDS to answer a 200 on :3000. Measured on this submission
// (osx-arm64, quiet box — a native host, so a FLOOR and not a typical case):
//
//     first-ever start, nothing on disk   80.8s   ← fetches PostgreSQL, initdb, builds the platform, seeds admin
//     PostgreSQL present, instance fresh  21.7s   ← still over budget: 11.2s of it is Admin + PlatformState
//     a pre-built instance, relocated      7.6s   ← what this block buys
//
// And the fetch is not merely slow there: the judge boundary blocks "unrelated outbound network access", so the
// 130 MB bundle download cannot complete at all. Both halves therefore ship with the submission, in `runtime/`
// beside the binary — deliberately NOT inside `app-template/`, which their `prepareOutput` copies into the model's
// own workspace. Neither of these is the model's business and neither should appear in its `ls`.
// ⛔ THE NATIVE LIBRARIES, WITHOUT WHICH NOTHING OF OURS RUNS AT ALL. A self-contained .NET binary still takes
//    OpenSSL from the host, and `node:22.19.0-bookworm-slim` — the image the organizers pin — has none: node links
//    its own statically. Measured there: the binary answers "No usable version of libssl was found" and exits
//    before Main. That is not a slow start, it is no start.
//
//    Our Dockerfile apt-gets it, which helps only if the judges build our image, and their checklist says they may
//    build in a runtime of their own with `npm ci --ignore-scripts` (so no postinstall hook either). Carrying
//    libssl.so.3 + libcrypto.so.3 costs 5.2 MB and depends on nobody.
//
// ⚑ ICU IS NOT IN THAT SET, DELIBERATELY. The publish already ships app-local ICU 72.1.0.3
//    (`Microsoft.ICU.ICU4C.Runtime`, pinned by OsyIcuVersion + System.Globalization.AppLocalIcu) so that culture
//    formatting is DETERMINISTIC — the client's formatter is pinned byte-for-byte against the server's output.
//    Vendoring Debian's libicu next to it would add 36 MB of a DIFFERENT ICU build beside the one that pin exists
//    to guarantee. Proof it is unnecessary: with only the two OpenSSL files present the runtime starts, and a .NET
//    process on Linux with no ICU at all cannot start.
const libDir = vendoredDir('lib');
if (libDir) {
  process.env.LD_LIBRARY_PATH = [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  // ⚠ AND THE TRUST STORE, WHICH IS A SEPARATE MISS. Their base image has no ca-certificates either, so .NET has
  //   no roots and every HTTPS call fails with "The SSL connection could not be established" even once libssl is
  //   present. Measured: that is what stopped the linux seed from building, one layer past the libssl fix.
  const caBundle = join(libDir, 'ca-certificates.crt');
  if (existsSync(caBundle) && !process.env.SSL_CERT_FILE) process.env.SSL_CERT_FILE = caBundle;
}

// The PostgreSQL binaries. $OSY_PG_DIR is a directory OF BUNDLES — the platform appends the pinned tag itself.
const pgDir = vendoredDir('pg');
if (pgDir && !process.env.OSY_PG_DIR) process.env.OSY_PG_DIR = pgDir;

// The instance: a cluster with the platform, Admin and PlatformState already built. `osy` derives an instance
// directory from the project path unless it is NAMED, so the name is pinned here — without it the vendored tree
// would be placed under one name and the server would look under another.
const devName = process.env.OSY_DEVNAME || 'challenge';
process.env.OSY_DEVNAME = devName;

// ⛔ A TARBALL, NOT A DIRECTORY, AND THAT IS FORCED — git does not store directory permissions. PostgreSQL refuses
//    a cluster whose data directory is group-readable (`FATAL: data directory … has invalid permissions. DETAIL:
//    Permissions should be u=rwx (0700)`), so an expanded tree committed to the repo arrives at 0755 and the
//    platform cannot boot. Measured twice here: `cp -R` flattened it, and restoring the mode from the copied source
//    faithfully restored the flattened one. A tar archive carries modes, and is 28 MB against 151 MB expanded.
const seed = vendoredDir('instance.tgz');
const target = join(homedir(), '.osy', 'instances', devName);
if (seed && !existsSync(target)) {
  // ⚠ STAGE THEN RENAME. A first run killed midway would otherwise leave a directory that exists, satisfies the
  //   check above, and is missing whatever had not been written — a corrupt platform no later run would repair.
  const staging = `${target}.staging.${process.pid}`;
  try {
    mkdirSync(staging, { recursive: true });
    const untar = spawnSync('tar', ['-xzf', seed, '-C', staging, '--strip-components=1'], { stdio: 'pipe' });
    if (untar.status !== 0) throw new Error((untar.stderr?.toString() || `tar exited ${untar.status}`).trim());
    // The descriptor records where the instance was BUILT. Left stale it names a directory that does not exist on
    // this machine, which is what `osy instances --stale` reports and what the idle reaper prunes.
    const descriptor = join(staging, 'instance.json');
    if (existsSync(descriptor)) {
      const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
      const d = JSON.parse(readFileSync(descriptor, 'utf8'));
      writeFileSync(descriptor, JSON.stringify({
        ...d, ProjectDir: process.cwd(), CheckoutRoot: process.cwd(), LastUsedUtc: now,
      }));
    }
    renameSync(staging, target);
  } catch (err) {
    // ⛔ NEVER FATAL. Without the seed the platform builds itself from source — slower but correct. So a failure
    //    here costs time, never the run. Say so: a silent fall-back looks exactly like the seed having worked.
    rmSync(staging, { recursive: true, force: true });
    console.error(`Could not place the pre-built platform instance (${err.message}) — starting from source instead.`);
  }
}

const args = process.argv.slice(2);
if (args[0] === 'serve' && !args.includes('--port') && !args.includes('-p')) args.push('--port', '3000');

const child = spawn(found, args, {
  stdio: 'inherit',
  env: { ...process.env, OSY_SURFACE: 'osy' },
});
child.on('error', (err) => {
  console.error(
    `Could not run the Osy# runtime (${found}): ${err.message}\n` +
    `  Looked for: ${candidates.join(', ')} then \`osy\` on PATH.\n` +
    `  Set OSY_BIN to the binary if it lives somewhere else.`,
  );
  process.exit(127);
});
// ⛔ FORWARD THE SIGNAL, OR THE SERVER NEVER HEARS IT — and their gate is exactly this: SIGTERM the dev server,
//    then require the port to CLOSE. Two things stack up and either alone is enough to break it:
//
//    · A spawned child is its own process. Signalling this script does not signal it, so `osy serve` kept running.
//    · This script is PID 1 in the container, and the kernel does NOT apply default signal dispositions to PID 1.
//      With no explicit listener, node IGNORED SIGTERM outright — so the container did not stop at all, and
//      `docker stop` fell through to SIGKILL after its timeout.
//
//    MEASURED 2026-08-19: the container was still Up 42 seconds after SIGTERM and had to be killed. A judged run
//    would see the port stay open. Forwarding costs nothing and the child's own exit still decides ours.
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => { try { child.kill(sig); } catch { /* already gone */ } });
}

child.on('exit', (code, signal) => {
  if (signal) { process.kill(process.pid, signal); return; }
  process.exit(code ?? 1);
});
