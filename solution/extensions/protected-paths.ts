import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";

export const PI_DOCUMENTATION_HEADING = "Pi documentation (read only when ";
const PI_DOCUMENTATION_BLOCK_START = `\n\n${PI_DOCUMENTATION_HEADING}`;

export function stripPiDocumentationBlock(systemPrompt: string): string {
  const blockStart = systemPrompt.indexOf(PI_DOCUMENTATION_BLOCK_START);
  if (blockStart < 0) return systemPrompt;

  const headingEnd = systemPrompt.indexOf("\n", blockStart + PI_DOCUMENTATION_BLOCK_START.length);
  if (headingEnd < 0) return systemPrompt;

  let lineStart = headingEnd + 1;
  let bulletCount = 0;
  while (systemPrompt.startsWith("- ", lineStart)) {
    bulletCount += 1;
    const lineEnd = systemPrompt.indexOf("\n", lineStart);
    if (lineEnd < 0) return systemPrompt.slice(0, blockStart);
    lineStart = lineEnd + 1;
  }
  if (bulletCount === 0) return systemPrompt;

  return systemPrompt.slice(0, blockStart) + systemPrompt.slice(Math.max(blockStart, lineStart - 1));
}

/**
 * The ceiling Pi puts on a single response when the model's own definition declares none.
 *
 * ⛔ 16384 IS A FALLBACK, NOT A FACT ABOUT THE MODEL. Pi composes every model as
 * `maxTokens: definition.maxTokens ?? 16384`, and a CUSTOM provider — which is how both judged models are
 * reached — usually declares neither `maxTokens` nor `contextWindow`. So the cap is 16k by default, and a turn
 * that reasons at length is TRUNCATED mid-thought.
 *
 * ⚑ THE EVIDENCE IS IN THE EVENT STREAM, and it is not subtle. FOUR consecutive runs each ended a turn with
 *
 *     stopReason: "length"
 *     usage: { input: 6260, output: 16384, reasoning: 16384, cacheRead: 40704 }
 *     thinking: 62,677 chars
 *
 * — `output` landing on exactly 16384 in all four (16384/16384/16384/16384), which is the signature of a ceiling
 * rather than a finished answer. And the damning part is the second number: `reasoning` is the WHOLE of `output`,
 * so the turn spent its entire budget thinking and emitted ZERO tokens of answer. That is how those runs produced
 * an empty app. Nothing reports "bytes trimmed" — a stop reason plus an output count sitting exactly on the cap is
 * what truncation looks like from outside. The two runs since show `stopReason: "stop"` and no length-stop at all.
 *
 * ⚑ WHY 32768 AND NOT THE MAXIMUM — and the two reasons you would expect are BOTH measured false.
 *
 *   · The endpoint does not mind. On api.berget.ai/v1, both judged models — `zai-org/GLM-5.2` and
 *     `Qwen/Qwen3.8-27B-FP8` — accepted max_tokens of 16384/32768/65536/131072, and still accepted 131072 with a
 *     53,000-token prompt. So they do NOT validate `prompt_tokens + max_tokens <= context_length`, which is the
 *     usual reason a high ceiling breaks late in a run rather than at the start.
 *   · Pi does not mind either. Compaction triggers on `contextTokens > contextWindow - reserveTokens`
 *     (compaction.js `shouldCompact`) — `model.maxTokens` is not in it, so a big ceiling does not make Pi compact
 *     sooner or re-send more input.
 *
 *   So the ceiling is set to what the endpoint accepts, and the reason is an ASYMMETRY rather than a balance.
 *
 *   The tempting argument for a low ceiling is the scoring formula — output is weighted x3
 *   (`input + output*3 + cache_read*0.1`), so a runaway 100k-token turn costs 300,000 weighted tokens, about half
 *   a good total. That argument is real but it is the SMALLER risk, and treating the two as comparable was the
 *   mistake. The metric is "token efficiency for submissions PASSING baseline functional journeys": a truncated
 *   turn does not score badly, it does not score. A runaway is continuous (rank worse); a truncation is
 *   categorical (out).
 *
 *   And the evidence points the same way. We know the model exceeded 16,384 tokens of pure reasoning — 62,677
 *   characters of it, still going when the cap stopped it. We do not know where it would have finished. Picking
 *   32768 would have been a guess that it needs less than twice what it already blew through; 40k of reasoning is
 *   entirely plausible and would fail exactly as before, for the same reason, having "fixed" it.
 *
 * ⚠ AND IT ONLY EVER RAISES A VALUE THAT IS THE DEFAULT. A model definition declaring its own smaller cap is
 * stating a real limit, and overriding that is how every request starts failing with a 400 — the one outcome
 * worse than a truncated turn.
 */
const PI_DEFAULT_MAX_TOKENS = 16384;
const RAISED_MAX_TOKENS = 131072;

/** The spellings the three provider APIs use for the same ceiling. */
const MAX_TOKEN_KEYS = ["max_tokens", "max_completion_tokens", "max_output_tokens"] as const;

export function raiseDefaultMaxTokens(payload: unknown): unknown {
  if (payload === null || typeof payload !== "object") return payload;
  const body = payload as Record<string, unknown>;
  for (const key of MAX_TOKEN_KEYS) {
    const current = body[key];
    // Never invent the field: a provider that was not sent one must not start receiving one.
    if (typeof current !== "number" || current <= 0) continue;
    if (current > PI_DEFAULT_MAX_TOKENS) continue;   // a declared, deliberate cap — leave it alone
    body[key] = RAISED_MAX_TOKENS;
  }
  return body;
}

export default function protectedPaths(pi: ExtensionAPI) {
  const appRoot = process.cwd();

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: stripPiDocumentationBlock(event.systemPrompt),
  }));

  // The returned payload REPLACES the request (extensions/runner.js: `if (handlerResult !== undefined)
  // currentPayload = handlerResult`), which is what makes this reachable without knowing the model id.
  pi.on("before_provider_request", async (event) => raiseDefaultMaxTokens(event.payload));

  pi.on("tool_call", async (event, context) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return undefined;
    const candidate = String((event.input as Record<string, unknown>).path ?? "");
    const absolute = path.resolve(appRoot, candidate);
    const relative = path.relative(appRoot, absolute);
    const outsideApp = relative.startsWith("..") || path.isAbsolute(relative);
    const segments = relative.split(path.sep);
    const basename = path.basename(absolute).toLowerCase();
    const protectedPath =
      outsideApp ||
      segments.includes(".git") ||
      segments.includes("node_modules") ||
      basename === "result.json" ||
      basename === ".env" ||
      basename.startsWith(".env.");
    if (!protectedPath) return undefined;

    if (context.hasUI) context.ui.notify(`Blocked write to protected path: ${candidate}`, "warning");
    return { block: true, reason: "Path is outside the app workspace or is runner-owned" };
  });
}
