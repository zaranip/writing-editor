import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt, maskApiKey } from "@/lib/crypto";

// GET — fetch all API keys for the user (masked)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return masked keys
  const maskedKeys = (keys ?? []).map((key) => ({
    id: key.id,
    provider: key.provider,
    maskedKey: maskApiKey(decrypt(key.encrypted_key)),
    created_at: key.created_at,
  }));

  return NextResponse.json(maskedKeys);
}

// POST — create or update an API key
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { provider, apiKey } = await request.json();

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: "Provider and apiKey are required" },
      { status: 400 }
    );
  }

  if (!["openai", "anthropic", "google"].includes(provider)) {
    return NextResponse.json(
      { error: "Invalid provider" },
      { status: 400 }
    );
  }

  const encryptedKey = encrypt(apiKey);

  // Upsert: insert or update on conflict (user_id, provider)
  const { error } = await supabase
    .from("api_keys")
    .upsert(
      {
        user_id: user.id,
        provider,
        encrypted_key: encryptedKey,
      },
      { onConflict: "user_id,provider" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — delete an API key
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { provider } = await request.json();

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
