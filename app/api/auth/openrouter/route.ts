import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
} from "@/lib/auth/openrouter-oauth";

// GET: Initiate OpenRouter OAuth flow
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Generate PKCE codes
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store code verifier in a secure cookie (will be needed for exchange)
  const cookieStore = await cookies();
  cookieStore.set("openrouter_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  // Build callback URL
  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/api/auth/openrouter/callback`;

  // Build OpenRouter auth URL and redirect
  const authUrl = buildAuthUrl(callbackUrl, codeChallenge);

  return NextResponse.redirect(authUrl);
}
