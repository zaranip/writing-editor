import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForApiKey } from "@/lib/auth/openrouter-oauth";
import { encrypt } from "@/lib/crypto";

// GET: Handle OpenRouter OAuth callback
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Handle errors from OpenRouter
  if (error) {
    console.error("OpenRouter OAuth error:", error);
    return NextResponse.redirect(
      `${url.origin}/dashboard/settings?error=openrouter_auth_failed`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${url.origin}/dashboard/settings?error=no_code`
    );
  }

  // Get the code verifier from the cookie
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("openrouter_code_verifier")?.value;

  if (!codeVerifier) {
    return NextResponse.redirect(
      `${url.origin}/dashboard/settings?error=no_verifier`
    );
  }

  // Clear the verifier cookie
  cookieStore.delete("openrouter_code_verifier");

  // Get the current user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${url.origin}/login?error=not_authenticated`
    );
  }

  try {
    // Exchange the code for an API key
    const { key } = await exchangeCodeForApiKey(code, codeVerifier);

    // Encrypt and store the API key
    const encryptedKey = encrypt(key);

    // Upsert the API key (replace if exists)
    const { error: dbError } = await supabase
      .from("api_keys")
      .upsert(
        {
          user_id: user.id,
          provider: "openrouter",
          encrypted_key: encryptedKey,
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (dbError) {
      console.error("Failed to save API key:", dbError);
      return NextResponse.redirect(
        `${url.origin}/dashboard/settings?error=save_failed`
      );
    }

    // Success - redirect back to settings
    return NextResponse.redirect(
      `${url.origin}/dashboard/settings?success=openrouter_connected`
    );
  } catch (err) {
    console.error("Failed to exchange code:", err);
    return NextResponse.redirect(
      `${url.origin}/dashboard/settings?error=exchange_failed`
    );
  }
}
