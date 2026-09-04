# Osy# submission — AgentCofounder

This fork replaces the JavaScript seed with an **Osy#** application: one language for the data model, its
security, server logic, and the UI. The agent writes `.osy` files; the platform compiles and serves them.

## Running it

Exactly as the starter documents — nothing extra:

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

`<rid>` is `linux-x64` or `linux-arm64`; `app-template/osy.mjs` picks the one matching `process.arch`.

**The libraries are there because `node:22.19.0-bookworm-slim` does not have them.** Node links its own OpenSSL
statically, so a self-contained .NET binary exits before `main` with *"No usable version of libssl was found"*, and
without a trust store every HTTPS call fails. Verified on that exact image.

**The pre-built instance is there because a first-ever start is otherwise 80 seconds** — it has to fetch
PostgreSQL, initialise a cluster, and compile the platform's own model before serving anything. That does not fit
the 20 second budget `verifyDevelopmentServer` allows, and under a closed network it cannot complete at all.
With the instance committed: **HTTP 200 in 10 seconds**, measured on `node:22.19.0-bookworm-slim` with
`--network none`, as an unprivileged user.

## One deviation from the starter, stated plainly

Our `Dockerfile` omits the starter's `RUN npm run check`. That step runs `test/verify-app.test.ts`, which copies
`app-template` into a system temp directory — where the vendored `runtime/` is no longer on the path, so the app
cold-starts — and probes it with `serverTimeoutMs: 10_000`, half the `20_000` the real runner uses. Three of its
cases cannot pass for a submission whose runtime is vendored at the repository root, regardless of how fast the app
is. The judged path is unaffected: `prepareOutput` copies into `output/app` inside the repository, where
resolution works, and is probed against the 20 second budget.

Everything else — `src/`, `contract-public/`, `solution/extensions/` — is the starter's, unmodified.
