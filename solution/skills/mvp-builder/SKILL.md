---
name: mvp-builder
description: Turn a non-technical product idea into a small, tested application while recording assumptions.
---

# MVP Builder

1. Extract the entity, its attributes, every journey detailed or implied by the idea, and any ambiguity.
2. Use the public journey guidance as a coverage check. Implement every applicable pattern, but omit patterns the idea does not imply instead of inventing substitute features; record the rationale in `assumptions`.
3. Declare the data as entities. Persistence is the platform's, not yours: an entity's rows survive a refresh and a restart, so do not reach for browser storage or invent an external API. Keep domain operations in functions rather than in the page that calls them.
4. Implement accessible controls, validation, empty states, errors, and responsive layout. Handle duplicate or repeated actions, boundary values, and recoverable runtime failures where relevant.
5. Keep components focused, separate concerns, and avoid duplication so another developer or agent can extend the app without a rewrite.
6. Use only what the project already provides. Do not add packages or run dependency-install commands.
7. Test every applicable observable user behavior with `[Test]` cases in `tests/**/*.test.osy`, driving the real page and asserting what it shows and what it stored. Startup and assumptions reporting are runner obligations, not UI test journeys. Every committed test must run and pass; do not leave skipped or todo tests.
8. Run the tests and the production build before reporting success.
9. Write `report.partial.json` with this exact shape:

```json
{
  "status": "success",
  "app_url": "http://localhost:3000",
  "start_command": "npm run dev",
  "summary": "Short description of the application",
  "implemented_features": ["Feature"],
  "assumptions": ["Ambiguity and the decision made"],
  "tests_run": [
    {
      "command": "npm test",
      "journey": "User-visible behaviour that was verified",
      "result": "passed"
    }
  ]
}
```

Use `success` only when `tests_run` contains at least one user journey and every entry passed. Use `partial` when useful functionality remains incomplete or any journey failed or was not run, and `failed` when the app cannot run. Never invent a passing test.
Use only `passed` or `failed` for each test result. Record an unrun check as `failed` and explain why in its journey.
