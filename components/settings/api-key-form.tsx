"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Check, Key, Eye, EyeOff, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface StoredKey {
  id: string;
  provider: string;
  maskedKey: string;
  created_at: string;
}

interface ProviderConfig {
  id: "openrouter" | "openai" | "anthropic" | "google";
  name: string;
  description: string;
  placeholder?: string;
  link?: string;
  oauth?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openrouter",
    name: "OpenRouter (Recommended)",
    description: "One click to connect. Access GPT-4o, Claude, Gemini, DeepSeek, and 100+ models.",
    placeholder: "sk-or-...",
    oauth: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4o Mini, embeddings",
    placeholder: "sk-...",
    link: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude Sonnet 4, Claude 3.5 Haiku",
    placeholder: "sk-ant-...",
    link: "https://console.anthropic.com/",
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini 2.0 Flash, Gemini 2.5 Pro",
    placeholder: "AIza...",
    link: "https://makersuite.google.com/app/apikey",
  },
];

// Inner component that uses useSearchParams
function ApiKeyFormInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Handle OAuth callback params
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    
    if (success === "openrouter_connected") {
      setNotification({ type: "success", message: "OpenRouter connected successfully!" });
      // Clear URL params
      router.replace("/dashboard/settings", { scroll: false });
      // Refresh keys
      fetchKeys();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        "missing_code": "Authorization failed - no code received",
        "missing_verifier": "Authorization failed - session expired",
        "exchange_failed": "Failed to connect to OpenRouter",
        "no_api_key": "OpenRouter did not provide an API key",
        "save_failed": "Failed to save API key",
      };
      setNotification({ 
        type: "error", 
        message: errorMessages[error] || `Connection failed: ${error}` 
      });
      router.replace("/dashboard/settings", { scroll: false });
    }
  }, [searchParams, router]);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveKey(provider: string) {
    const apiKey = newKeys[provider];
    if (!apiKey) return;

    setSaving((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (res.ok) {
        setNewKeys((prev) => ({ ...prev, [provider]: "" }));
        await fetchKeys();
      }
    } finally {
      setSaving((prev) => ({ ...prev, [provider]: false }));
    }
  }

  async function deleteKey(provider: string) {
    const res = await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (res.ok) {
      await fetchKeys();
    }
  }

  function startOAuthFlow(provider: string) {
    setConnecting((prev) => ({ ...prev, [provider]: true }));
    // Redirect to OAuth initiation endpoint
    window.location.href = `/api/auth/${provider}`;
  }

  function getStoredKey(provider: string) {
    return keys.find((k) => k.provider === provider);
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading API keys...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Notification banner */}
      {notification && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            notification.type === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {notification.message}
          <button
            onClick={() => setNotification(null)}
            className="ml-auto text-current opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {PROVIDERS.map((provider) => {
        const stored = getStoredKey(provider.id);
        const isOAuth = provider.oauth;
        const isConnecting = connecting[provider.id];

        return (
          <Card key={provider.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    {provider.name}
                    {stored && (
                      <Badge variant="secondary" className="text-xs">
                        Connected
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {provider.description}
                    {provider.link && (
                      <>
                        {" · "}
                        <a
                          href={provider.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Get API key →
                        </a>
                      </>
                    )}
                  </CardDescription>
                </div>
                {stored && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteKey(provider.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {stored ? (
                <p className="text-sm text-muted-foreground font-mono">
                  {stored.maskedKey}
                </p>
              ) : isOAuth ? (
                // OAuth flow - show connect button
                <Button
                  onClick={() => startOAuthFlow(provider.id)}
                  disabled={isConnecting}
                  className="w-full sm:w-auto"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect with OpenRouter
                    </>
                  )}
                </Button>
              ) : (
                // API key flow - show input field
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKeys[provider.id] ? "text" : "password"}
                      placeholder={provider.placeholder}
                      value={newKeys[provider.id] || ""}
                      onChange={(e) =>
                        setNewKeys((prev) => ({
                          ...prev,
                          [provider.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [provider.id]: !prev[provider.id],
                        }))
                      }
                    >
                      {showKeys[provider.id] ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => saveKey(provider.id)}
                    disabled={!newKeys[provider.id] || saving[provider.id]}
                  >
                    {saving[provider.id] ? (
                      "Saving..."
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Exported component with Suspense boundary for useSearchParams
export function ApiKeyForm() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading API keys...</div>}>
      <ApiKeyFormInner />
    </Suspense>
  );
}
