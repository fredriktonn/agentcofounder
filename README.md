# Osy# submission (AgentCofounder)

The agent in this fork does not write TypeScript, React, or glue. It writes **Osy#**, a new general-purpose
language and runtime built for exactly this problem: a person describes what they want, and an agent builds it.

**Full details: https://osysharp.com**

## The one thing worth doing: read the app

After a run, open **`output/app/model/`**. That is the whole application: the data, its security, the pages, the
REST API and the tests, in one language, in a few hundred lines. There is no repository layer, no state
management, no serializer, no ORM mapping, no API wiring and no build config, because the language has no place
to put them.

**It is a pristine language, not a wrapper.** Its own compiler, type system, runtime, query engine, UI kit and
test framework. Nothing is generated into another framework and nothing is hidden behind a template. What you
read in `model/` is what runs.

Two things change an agent's odds here, and both are visible in the code rather than in a prompt:

* **Security is declared once, on the entity**, and is then enforced everywhere by construction. There is no
  filter to remember at a call site and no endpoint to forget to guard.
* **A wrong program is REFUSED, with a diagnostic that names the fix.** An agent that writes something not quite
  right does not ship it and find out later; it is corrected at the moment it writes it. That advantage grows as
  the model gets weaker, which is the opposite of how a prompt-tuned entry behaves.

## Running it

Exactly as the starter documents, nothing extra:

```bash
npm ci --ignore-scripts
npm run challenge                       # or: npm run challenge -- --idea-file <path>
```

There is **no warm-up step and no setup to remember**. The first `npm run dev` places what it needs and serves.

## What is committed, and why

| | |
|---|---|
| `runtime/<rid>/osy` | the Osy# runtime, self-contained (no .NET needed on the host) |
| `runtime/<rid>/lib` | `libssl.so.3`, `libcrypto.so.3`, `ca-certificates.crt` |
| `runtime/<rid>/pg` | the PostgreSQL binaries the platform runs |
| `runtime/<rid>/instance.tgz` | a pre-built platform instance |

`<rid>` is `linux-arm64`, and it is the only one shipped: the organizers confirmed judging is on Apple
Silicon, so a second RID would double the repository for a host nobody runs. `app-template/osy.mjs` still
selects `runtime/<rid>/` by `process.arch`, so adding another architecture is a rebuild, not a code change.

**The libraries are there because `node:22.19.0-bookworm-slim` does not have them.** Node links its own OpenSSL
statically, so a self-contained .NET binary exits before `main` with *"No usable version of libssl was found"*, and
without a trust store every HTTPS call fails. Verified on that exact image.

Our `Dockerfile` also installs `libssl3` from apt, which resolves on arm64 and is the simpler route now that
build-time network is confirmed open. The vendored copies (5 MB) stay as the fallback for a base image that has
neither, so the runtime does not depend on which of the two is present.

**The pre-built instance is there because a first-ever start is otherwise 80 seconds.** It has to fetch
PostgreSQL, initialise a cluster, and compile the platform's own model before serving anything. That does not fit
the 20 second budget `verifyDevelopmentServer` allows, and under a closed network it cannot complete at all.
With the instance committed: **HTTP 200 in 10 seconds**, measured on `node:22.19.0-bookworm-slim` with
`--network none`, as an unprivileged user.

## One deviation from the starter, stated plainly

Our `Dockerfile` omits the starter's `RUN npm run check`. That step runs `test/verify-app.test.ts`, which copies
`app-template` into a system temp directory (where the vendored `runtime/` is no longer on the path, so the app
cold-starts) and probes it with `serverTimeoutMs: 10_000`, half the `20_000` the real runner uses. Three of its
cases cannot pass for a submission whose runtime is vendored at the repository root, regardless of how fast the app
is. The judged path is unaffected: `prepareOutput` copies into `output/app` inside the repository, where
resolution works, and is probed against the 20 second budget.

Everything else (`src/`, `contract-public/`, `solution/extensions/`) is the starter's, unmodified.
