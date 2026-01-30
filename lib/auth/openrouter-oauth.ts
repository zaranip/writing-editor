/**
 * OpenRouter OAuth PKCE utilities
 * 
 * Flow:
 * 1. Generate code verifier and challenge
 * 2. Redirect user to OpenRouter auth page
 * 3. User authorizes and is redirected back with a code
 * 4. Exchange code for API key
 */

// Generate a random code verifier for PKCE
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Generate code challenge from verifier using SHA-256
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

// Base64 URL encode (no padding, URL-safe)
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Build the OpenRouter authorization URL
export function buildAuthUrl(callbackUrl: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://openrouter.ai/auth?${params.toString()}`;
}

// Exchange authorization code for API key
export async function exchangeCodeForApiKey(
  code: string,
  codeVerifier: string
): Promise<{ key: string; userId: string }> {
  const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      code_challenge_method: "S256",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();
  return {
    key: data.key,
    userId: data.user_id,
  };
}
