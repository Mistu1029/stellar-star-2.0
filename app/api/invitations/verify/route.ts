import { NextRequest, NextResponse } from "next/server";
import { createServerAnonClient } from "@/lib/supabase/server";
import { verifyTripInvite } from "@/lib/invitations/claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token || token.trim() === "") {
    return NextResponse.json({ error: "token parameter is required." }, { status: 400 });
  }

  try {
    // Verifying an invite is deliberately unauthenticated — the recipient has
    // no session yet. It still needs a *server* client: the browser one reads
    // its token from localStorage, which does not exist in this runtime.
    const summary = await verifyTripInvite(token.trim(), createServerAnonClient());
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid or unrecognized invitation.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
