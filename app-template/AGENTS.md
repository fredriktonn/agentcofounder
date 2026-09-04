# Generated application contract

You are building an **Osy# app**, not a JavaScript one: the whole application — data, logic, pages and tests — is
`.osy` source. Your project instructions describe the language; this file describes only what this workspace expects.

- Write the app in `model/**/*.osy` and its tests in `tests/**/*.test.osy`. `app.osy` already globs both.
- Run every `osy` verb as `node ./osy.mjs <verb>` — `osy check`, `osy test`, `osy kit`, `osy docs`. The CLI is
  vendored beside the app rather than installed, so it is not on `PATH`.
- Data you store in an entity is durable and survives a browser refresh — the platform persists it. You do not need
  to reach for browser storage.
- Give controls their accessible names (`label:`) so browser automation can find them without brittle selectors.
- **The seed contains no product tests.** Add at least one completed, passing `[Test]` in `tests/**/*.test.osy`.
  The runner rejects zero-test reports and any skipped or todo test — so a `[Skip]` counts against you rather than
  for you.
- **Run `npm test` before you finish — this one is not optional and not interchangeable.** It runs your `.osy`
  tests AND records each one as a `tests_run` journey in `report.partial.json`, which is the only evidence the
  runner accepts that your app works. `node ./osy.mjs test` runs the same tests and records NOTHING, so a run that
  used it reports zero journeys and is capped at `partial` however green everything was.
- **Never leave a server running, and never take port 3000.** The runner starts the app itself when you are done,
  and it needs that port free. If you start one to look at something, stop it with `node ./osy.mjs stop` before you
  finish. A server you leave behind makes the runner's own startup check fail, which is recorded against your
  submission even though the app is fine. `node ./osy.mjs check` and `npm test` need no server and are the better
  way to confirm your work.
- Use only the dependencies already installed from the committed lockfile. Do not add packages or run installs.
- `report.partial.json` contains only `status`, `app_url`, `start_command`, `summary`, `implemented_features`,
  `assumptions` and `tests_run`.
- A `success` report must contain at least one `tests_run` entry and every entry must be `passed`. If a journey
  failed or was not run, record it as `failed`, explain why in `journey`, and use `partial` (or `failed` when the
  app cannot run).
- The runner owns the final `app_url`, the location-aware `start_command`, its independent `harness_checks` and the
  telemetry fields. Your product-journey records belong in `tests_run`.
- Do not create or edit `result.json`; the outer challenge runner derives its telemetry from the agent's own stream.
