// THE APP'S OWN TESTS, REPORTED TO VITEST — one vitest case per `.test.osy` test.
//
// An Osy# app is tested in Osy#: a `[Test]` runs against the real app, in a throwaway branch of its database, and a
// UI journey drives the real client against the real server. That is a far stronger journey test than jsdom can
// give, and it is what `osy test` runs. This file exists only so the OUTER runner — which knows how to read a
// vitest JSON report and nothing else — can see those results.
//
// ⚠ IT MUST NOT INVENT A CASE. The whole point of the outer gate is "at least one completed test, none skipped or
// todo", so this file declares exactly the tests the app declares, and fails loudly when there are none — a bridge
// that reported one green "all good" case would satisfy the gate while proving nothing.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Has anyone written an application here yet? — `model/**\/*.osy`, which is where one lives.
 *
 *  ⚠ THIS IS THE SEED-VS-FINISHED DISTINCTION, and it decides whether "no tests" is fine or fatal. The outer
 *  harness runs this file TWICE with opposite expectations: `npm run check` on the PRISTINE template, with
 *  `--passWithNoTests` (a seed that declares nothing must pass), and again after the model has worked, with
 *  `--passWithNoTests=false` (an app that proves nothing must fail). Declaring zero cases for a seed and a
 *  failing case for a finished app with no tests satisfies both — using THEIR flag rather than inventing a
 *  signal of our own. */
function hasApplicationSource(dir: string): boolean {
  let found = false;
  const walk = (d: string) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (found) return;
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name.endsWith('.osy')) found = true;
    }
  };
  walk(dir);
  return found;
}

interface OsyEvent { event: string; data: Record<string, unknown> }

// Run ONCE, at collection time, so each result can become its own `test()`. `osy test` starts the local platform
// itself and stops nothing else; the events it prints are one JSON object per line, mixed with human lines that are
// deliberately not JSON (the "Starting a local platform…" banner), so anything unparseable is skipped.
function runOsyTests(): OsyEvent[] {
  let raw: string;
  try {
    raw = execFileSync('node', ['./osy.mjs', 'test', '--json'], {
      cwd: appRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env },
    });
  } catch (error) {
    // A non-zero exit means tests FAILED — which is a result, not a crash. The output still carries the events, so
    // read them and let the per-test assertions below report which journey broke.
    const withOutput = error as { stdout?: string | Buffer };
    raw = withOutput.stdout ? String(withOutput.stdout) : '';
    if (!raw) throw error;
  }

  const events: OsyEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try { events.push(JSON.parse(trimmed) as OsyEvent); } catch { /* a human line that happens to start with { */ }
  }
  return events;
}

// ── `tests_run` IS MACHINE-WRITTEN, AND THAT IS THE WHOLE POINT ──────────────────────────────────────────────────
//
// The outer runner reads `report.partial.json` the instant the model exits — BEFORE it verifies anything
// (`src/run-challenge.ts` reads the partial, then verifies, then composes both into `result.json`). So this file
// cannot be written during verification; it has to exist when the model stops. And the runner is unforgiving in
// ways that are invisible from the model's side:
//
//   · a missing or unparseable file  → the fallback partial, whose status is "failed" → THE WHOLE RUN IS `failed`,
//     however green the three gates were;
//   · `tests_run` empty, or every entry dropped → the run is capped at `partial`, never `success`;
//   · an entry missing `command`, `journey` or `result` is SILENTLY DROPPED, not rejected — a typo deletes the
//     evidence rather than reporting itself.
//
// Asking a model to transcribe its own test list into that schema is asking it to hand-copy the one part of the
// contract where a small mistake is both silent and fatal. We already ran the tests and hold the exact list, so we
// write it. The model keeps the parts that are genuinely its judgement — what it built, what it assumed, and
// whether it is claiming `success`.
//
// MERGE, never clobber: the model's prose survives every run, and only the mechanical half is replaced.
function writeTestsRun(runs: { command: string; journey: string; result: 'passed' | 'failed' }[]): void {
  const file = join(appRoot, 'report.partial.json');
  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>; } catch { /* first run */ }

  const report = {
    // The model's to claim. Absent, the runner normalises anything unrecognised to "partial" — so a report this
    // file creates on its own is honestly incomplete rather than falsely green.
    status: typeof existing.status === 'string' ? existing.status : 'partial',
    app_url: 'http://localhost:3000',
    start_command: 'npm run dev',
    // ⚠ NOT the empty string, and their schema is why: `summary` is `minLength: 1`, and a result that violates the
    // schema makes the runner exit 1 at the very last step — after everything else passed. Measured against their
    // own `result.schema.json` with ajv. A placeholder keeps the run valid and says plainly that a field is missing;
    // the model's own summary replaces it the moment it writes one.
    summary: typeof existing.summary === 'string' && existing.summary.length > 0
      ? existing.summary
      : 'An Osy# application. The model did not write a summary.',
    implemented_features: Array.isArray(existing.implemented_features) ? existing.implemented_features : [],
    assumptions: Array.isArray(existing.assumptions) ? existing.assumptions : [],
    tests_run: runs,
  };
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

// A pristine seed declares nothing and runs nothing: no platform start, no database, no cases. `npm run check`
// on a fresh fork must not boot a PostgreSQL to discover that the model directory is empty.
const events = hasApplicationSource(join(appRoot, 'model')) ? runOsyTests() : [];
const names = new Map<string, string>();
for (const e of events) {
  if (e.event === 'enqueued') names.set(String(e.data.testId), String(e.data.name));
}
const outcome = new Map<string, { event: string; message?: string }>();
for (const e of events) {
  if (e.event === 'passed' || e.event === 'failed' || e.event === 'errored' || e.event === 'skipped') {
    outcome.set(String(e.data.testId), { event: e.event, message: e.data.message as string | undefined });
  }
}

if (names.size === 0 && events.length === 0 && !hasApplicationSource(join(appRoot, 'model'))) {
  // The pristine seed. Declare nothing and let `--passWithNoTests` decide — true at `npm run check` (pass),
  // false at verification (fail), which is exactly what each of those moments means.
} else if (names.size === 0) {
  // An app EXISTS and declared no tests. Not a silent zero: the outer runner rejects a zero-test report, and a
  // reader deserves to know it was the APP that proved nothing rather than this bridge failing to find it.
  test('the app declares tests', () => {
    throw new Error(
      'No tests were declared in tests/**/*.test.osy — an app that proves nothing is not finished. ' +
      `osy test produced ${events.length} event(s).`,
    );
  });
} else {
  // The report the outer runner will read, written from the run that just happened. Anything that is not a clean
  // `passed` is reported as `failed` — the schema has no third value, and a skip or an error is emphatically not a
  // pass (a green report over a skipped journey is the one lie that would survive every other gate here).
  writeTestsRun([...names].map(([id, name]) => ({
    command: 'npm test',
    journey: name,
    result: outcome.get(id)?.event === 'passed' ? 'passed' as const : 'failed' as const,
  })));

  for (const [id, name] of names) {
    test(name, () => {
      const result = outcome.get(id);
      expect(result, `${id} never reported a result`).toBeDefined();
      // A skip is not a pass. Osy# marks a parked known-gap `[Skip]`, which is right in the language and wrong here.
      expect(result!.event, result!.message ?? `${name}: ${result!.event}`).toBe('passed');
    });
  }
}
