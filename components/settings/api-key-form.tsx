"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Check, Key, Eye, EyeOff } from "lucide-react";

interface StoredKey {
  id: string;
  provider: string;
  maskedKey: string;
  created_at: string;
}

const PROVIDERS = [
  {
    id: "openai" as const,
    name: "OpenAI",
    description: "GPT-4o, GPT-4o Mini, embeddings",
    placeholder: "sk-...",
  },
  {
    id: "anthropic" as const,
    name: "Anthropic",
    description: "Claude Sonnet 4, Claude 3.5 Haiku",
    placeholder: "sk-ant-...",
  },
  {
    id: "google" as const,
    name: "Google AI",
    description: "Gemini 2.0 Flash, Gemini 2.5 Pro",
    placeholder: "AIza...",
  },
];

export function ApiKeyForm() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

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

  function getStoredKey(provider: string) {
    return keys.find((k) => k.provider === provider);
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading API keys...</div>;
  }

  return (
    <div className="space-y-4">
      {PROVIDERS.map((provider) => {
        const stored = getStoredKey(provider.id);
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
                  <CardDescription>{provider.description}</CardDescription>
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
              ) : (
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
