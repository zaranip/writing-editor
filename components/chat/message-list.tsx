"use client";

import { Bot, User, Loader2, Globe, BookPlus, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UIMessage } from "ai";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
}

interface ToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  state: string;
  result?: unknown;
}

function SearchResultsList({ result }: { result: unknown }) {
  if (!result || typeof result !== "object") return null;
  const data = result as Record<string, unknown>;
  if (!Array.isArray(data.results)) return null;
  const items = data.results as Array<{ title: string; url: string; snippet: string }>;
  return (
    <div className="mt-2 space-y-1">
      {items.slice(0, 4).map((r, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs">
          <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate"
          >
            {r.title}
          </a>
        </div>
      ))}
    </div>
  );
}

function ToolInvocationPart({ invocation }: { invocation: ToolInvocation }) {
  const { toolName, args, state, result } = invocation;

  if (toolName === "webSearch") {
    return (
      <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span className="font-medium">
            {state === "result" ? "Searched the web" : "Searching the web..."}
          </span>
          {state !== "result" && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Query: &quot;{String(args.query)}&quot;
        </p>
        {state === "result" && <SearchResultsList result={result} />}
      </div>
    );
  }

  if (toolName === "readWebPage") {
    return (
      <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span className="font-medium">
            {state === "result" ? "Read web page" : "Reading web page..."}
          </span>
          {state !== "result" && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground truncate">
          {String(args.url)}
        </p>
      </div>
    );
  }

  if (toolName === "addToSources") {
    const addResult = result as { success?: boolean; message?: string } | undefined;
    return (
      <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookPlus className="h-4 w-4" />
          <span className="font-medium">
            {state === "result"
              ? addResult?.success
                ? "Added to sources"
                : "Failed to add source"
              : "Adding to sources..."}
          </span>
          {state !== "result" && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {String(args.title)}
        </p>
        {state === "result" && addResult?.message && (
          <p className="mt-1 text-xs text-muted-foreground">{addResult.message}</p>
        )}
      </div>
    );
  }

  // Generic fallback for unknown tools
  return (
    <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className={`h-4 w-4 ${state !== "result" ? "animate-spin" : ""}`} />
        <span className="font-medium">
          {state === "result" ? `Used ${toolName}` : `Running ${toolName}...`}
        </span>
      </div>
    </div>
  );
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Start a conversation</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask questions about your uploaded sources, request summaries,
            comparisons, or ask me to search the web for new research material.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 pb-4">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3">
            <div className="shrink-0">
              {message.role === "user" ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1 overflow-hidden">
              <p className="text-xs font-medium text-muted-foreground">
                {message.role === "user" ? "You" : "AI Assistant"}
              </p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {message.parts?.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={index}
                        className="whitespace-pre-wrap break-words"
                      >
                        {part.text}
                      </div>
                    );
                  }
                  if (part.type === "tool-invocation") {
                    const invocation = (part as unknown as { toolInvocation: ToolInvocation }).toolInvocation;
                    return (
                      <ToolInvocationPart
                        key={index}
                        invocation={invocation}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
