"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useState, useMemo, useCallback, useEffect } from "react";
import { MessageList } from "./message-list";
import { ModelSelector } from "./model-selector";
import { ChatStatus } from "./chat-status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, AlertCircle, Plus } from "lucide-react";
import { MODEL_OPTIONS, type LLMProvider } from "@/types";
import Link from "next/link";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

interface ChatInterfaceProps {
  projectId: string;
  availableProviders: string[];
  hasSources: boolean;
  chatId?: string;
  initialMessages?: UIMessage[];
  chatSessions?: ChatSession[];
  onChatChange?: (chatId: string) => void;
  onNewChat?: () => void;
}

export function ChatInterface({
  projectId,
  availableProviders,
  hasSources,
  chatId,
  initialMessages,
  chatSessions = [],
  onChatChange,
  onNewChat,
}: ChatInterfaceProps) {
  const defaultModel = MODEL_OPTIONS.find((m) =>
    availableProviders.includes(m.provider)
  );

  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(
    defaultModel?.provider ?? "openai"
  );
  const [selectedModel, setSelectedModel] = useState(
    defaultModel?.model ?? "gpt-4o"
  );
  const [inputValue, setInputValue] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          projectId,
          provider: selectedProvider,
          model: selectedModel,
          chatId,
        },
      }),
    [projectId, selectedProvider, selectedModel, chatId]
  );

  const { messages, status, sendMessage, error, setMessages } = useChat({
    id: chatId,
    transport,
    messages: initialMessages,
    onFinish: useCallback(() => {
      // The server handles persisting messages via onFinish in the route
    }, []),
  });

  // Reset messages when chatId changes and initialMessages are provided
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = status === "streaming" || status === "submitted";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue });
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const hasApiKeys = availableProviders.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Chat session header */}
      <div className="flex items-center gap-2 border-b pb-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              availableProviders={availableProviders}
              onSelect={(provider, model) => {
                setSelectedProvider(provider);
                setSelectedModel(model);
              }}
            />
          </div>
        </div>
        {onNewChat && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewChat}
            className="gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        )}
      </div>

      {/* Chat history selector */}
      {chatSessions.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-thin">
          {chatSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onChatChange?.(session.id)}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                session.id === chatId
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {session.title}
            </button>
          ))}
        </div>
      )}

      {/* Warnings */}
      {!hasApiKeys && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            No API keys configured.{" "}
            <Link href="/dashboard/settings" className="underline font-medium">
              Add your API keys
            </Link>{" "}
            to start chatting.
          </span>
        </div>
      )}

      {hasApiKeys && !hasSources && messages.length === 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            No sources uploaded yet. Add sources or ask me to search the web for research material.
          </span>
        </div>
      )}

      {/* Thinking / tool status bar */}
      <ChatStatus status={status} messages={messages} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            hasApiKeys
              ? "Ask about your sources or search the web..."
              : "Add API keys in Settings to start chatting"
          }
          disabled={!hasApiKeys || isLoading}
          className="min-h-[60px] max-h-[200px] resize-none"
          rows={2}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!hasApiKeys || !inputValue.trim() || isLoading}
          className="shrink-0 self-end h-[60px] w-[60px]"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
