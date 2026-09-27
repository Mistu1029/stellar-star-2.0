/**
 * Internal error-report sink.
 *
 * Client money-path failures POST here via `reportError` (lib/observability/
 * reportError). By landing in server logs in a stable, structured shape, the
 * failure becomes diagnosable on infrastructure the maintainer owns — not the
 * user's browser console, which is where `console.error` failures go to die.
 *
 * If `ERROR_REPORTING_WEBHOOK` is set, the same payload is also forwarded to
 * that URL (e.g. a Slack/Discord/incident hook) so a mainnet money-path
 * failure produces an alert, not just a log line.
 *
 * Because the route is unauthenticated by design (a client that cannot even
 * build a session must still be able to report why), every input is treated as
 * hostile: the body is size-capped before parsing, each field is clamped and
 * stripped of control characters so a report cannot forge log lines, and the
 * webhook forward is both rate-limited and timeout-bounded so it cannot be used
 * to amplify traffic at an upstream incident hook.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/auth/rateLimiter";

interface IncomingReport {
  name?: string;
  message?: string;
  stack?: string;
  severity?: string;
  context?: Record<string, unknown>;
  network?: string;
  appVersion?: string;
  timestamp?: string;
}

const ALLOWED_KEYS: (keyof IncomingReport)[] = [
  "name",
  "message",
  "stack",
  "severity",
  "context",
  "network",
  "appVersion",
  "timestamp",
];

/** Reports accepted per IP per minute. A real client reports single failures. */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Hard ceiling on the raw body, rejected before any parsing work. */
const MAX_BODY_BYTES = 16_384;

/** Per-field character caps. A stack is the only field that needs real room. */
const MAX_LENGTHS: Record<string, number> = {
  name: 200,
  message: 2_000,
  stack: 8_000,
  severity: 20,
  network: 50,
  appVersion: 50,
  timestamp: 40,
};

/** Bounds applied to the free-form `context` object. */
const MAX_CONTEXT_KEYS = 30;
const MAX_CONTEXT_KEY_LENGTH = 100;
const MAX_CONTEXT_VALUE_LENGTH = 500;

/** Timeout for the best-effort webhook forward. */
const WEBHOOK_TIMEOUT_MS = 5_000;

/**
 * Strips characters that would let a report forge log structure, then clamps.
 *
 * Newlines and carriage returns are the log-injection vector: the sink emits one
 * line per report, so an embedded newline lets a caller fabricate what looks
 * like a separate, legitimate log entry. ANSI escapes are dropped too, since a
 * maintainer reading logs in a terminal would otherwise have their output
 * rewritten by the payload.
 */
function sanitizeString(value: string, maxLength: number): string {
  const stripped = value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…[truncated]` : stripped;
}

/**
 * Reduces an untrusted `context` value to something safe to log.
 *
 * Only primitives survive as themselves; anything structured is summarised by
 * type rather than serialised, which keeps a deeply nested or cyclic object
 * from turning into an unbounded log line.
 */
function sanitizeContextValue(value: unknown): unknown {
  if (value === null) return null;
  switch (typeof value) {
    case "string":
      return sanitizeString(value, MAX_CONTEXT_VALUE_LENGTH);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "undefined":
      return undefined;
    default:
      return Array.isArray(value) ? `[array:${value.length}]` : `[${typeof value}]`;
  }
}

function sanitizeContext(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (count >= MAX_CONTEXT_KEYS) {
      out["…"] = "[context truncated]";
      break;
    }
    const safeKey = sanitizeString(key, MAX_CONTEXT_KEY_LENGTH);
    if (!safeKey.trim()) continue;
    const safeValue = sanitizeContextValue(raw);
    if (safeValue === undefined) continue;
    out[safeKey] = safeValue;
    count += 1;
  }
  return out;
}

export async function POST(req: NextRequest) {
  // Rate limit before reading the body: an abusive caller should not get to
  // spend server memory on a payload we are about to discard anyway.
  const clientIp = getClientIp(req);
  const ipLimit = await checkRateLimit(
    `error-report:ip:${clientIp}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many error reports. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(ipLimit.resetMs / 1000)),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // Reject oversized payloads on the declared length when we have one, so the
  // common case costs nothing to refuse.
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  // Content-Length is client-supplied and optional (e.g. chunked uploads), so
  // measure what actually arrived rather than trusting the header.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  let body: IncomingReport;
  try {
    body = JSON.parse(raw) as IncomingReport;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const receivedAt = new Date().toISOString();
  const clean: Record<string, unknown> = { receivedAt };
  for (const key of ALLOWED_KEYS) {
    const value = body[key];
    if (value === undefined) continue;

    if (key === "context") {
      const context = sanitizeContext(value);
      if (context && Object.keys(context).length > 0) clean.context = context;
      continue;
    }

    if (typeof value === "string") {
      clean[key] = sanitizeString(value, MAX_LENGTHS[key] ?? 200);
    }
    // Non-string values on string fields are dropped rather than coerced: a
    // report that lies about its own shape has nothing worth logging.
  }

  // Stable, machine-parseable marker so log pipelines can route/alert on it.
  console.error(`[StellarStar:client-error] ${JSON.stringify(clean)}`);

  const webhook = process.env.ERROR_REPORTING_WEBHOOK;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
        // Without this, a hung incident hook holds the request open and each
        // report ties up a server slot until the platform kills it.
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
    } catch {
      // Forwarding is best-effort; the server log above already captured it.
    }
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}

export function GET() {
  return NextResponse.json({ ok: true });
}
