"use client";

import { Bot, User, Loader2, Globe, BookPlus, ExternalLink, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";

// Metadata type for messages with sources used
interface MessageMetadata {
  sourcesUsed?: { id: string; title: string }[];
}

// Extended message type that includes sources used from metadata
type ExtendedUIMessage = UIMessage<MessageMetadata>;

interface MessageListProps {
  messages: ExtendedUIMessage[];
  isLoading: boolean;
}

function SourcesUsedDisplay({ sources }: { sources: { id: string; title: string }[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span className="font-medium">
          {sources.length === 1 ? "Source referenced" : `${sources.length} sources referenced`}
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {sources.map((source) => (
          <div key={source.id} className="flex items-start gap-1.5 text-xs">
            <FileText className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <span className="text-foreground">{source.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI SDK v6: server-defined tools come as "tool-{name}" parts for static tools
// or "dynamic-tool" for dynamic tools. Both have state, input, and output.
interface ToolPart {
  type: string;
  toolName?: string; // Present on dynamic-tool
  input?: Record<string, unknown>; // May be undefined during early streaming
  state: string;
  output?: unknown;
}

// Helper to check if a part is a tool invocation (static or dynamic)
function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

// Extract tool name from part type
function getToolName(part: ToolPart): string {
  if (part.type === "dynamic-tool") {
    return part.toolName || "unknown";
  }
  // Static tools have type "tool-{name}", extract the name
  return part.type.replace(/^tool-/, "");
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

function isOutputReady(state: string): boolean {
  return state === "output-available" || state === "output-error" || state === "output-denied";
}

function ToolPartView({ part }: { part: ToolPart }) {
  const toolName = getToolName(part);
  const { input, state, output } = part;

  if (toolName === "webSearch") {
    const query = input?.query;
    return (
      <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span className="font-medium">
            {isOutputReady(state) ? "Searched the web" : "Searching the web..."}
          </span>
          {!isOutputReady(state) && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        {query != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Query: &quot;{String(query)}&quot;
          </p>
        )}
        {isOutputReady(state) && <SearchResultsList result={output} />}
      </div>
    );
  }

  if (toolName === "readWebPage") {
    const url = input?.url;
    return (
      <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span className="font-medium">
            {isOutputReady(state) ? "Read web page" : "Reading web page..."}
          </span>
          {!isOutputReady(state) && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        {url != null && (
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {String(url)}
          </p>
        )}
      </div>
    );
  }

  if (toolName === "addToSources") {
    const title = input?.title;
    const addResult = output as { success?: boolean; message?: string } | undefined;
    return (
      <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookPlus className="h-4 w-4" />
          <span className="font-medium">
            {isOutputReady(state)
              ? addResult?.success
                ? "Added to sources"
                : "Failed to add source"
              : "Adding to sources..."}
          </span>
          {!isOutputReady(state) && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        {title != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            {String(title)}
          </p>
        )}
        {isOutputReady(state) && addResult?.message && (
          <p className="mt-1 text-xs text-muted-foreground">{addResult.message}</p>
        )}
      </div>
    );
  }

  // Generic fallback for unknown tools
  return (
    <div className="my-2 rounded-lg border bg-muted/50 p-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className={`h-4 w-4 ${!isOutputReady(state) ? "animate-spin" : ""}`} />
        <span className="font-medium">
          {isOutputReady(state) ? `Used ${toolName}` : `Running ${toolName}...`}
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
                      <div key={index} className="break-words">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: ({ children }) => (
                              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-sm">
                                {children}
                              </pre>
                            ),
                            code: ({ children, className }) => {
                              const isBlock = className?.startsWith("language-");
                              if (isBlock) {
                                return <code className={className}>{children}</code>;
                              }
                              return (
                                <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
                                  {children}
                                </code>
                              );
                            },
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary/80"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {part.text}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                  if (isToolPart(part)) {
                    return (
                      <ToolPartView
                        key={index}
                        part={part as unknown as ToolPart}
                      />
                    );
                  }
                  return null;
                })}
                {/* Show sources used for assistant messages */}
                {message.role === "assistant" && message.metadata?.sourcesUsed && message.metadata.sourcesUsed.length > 0 && (
                  <SourcesUsedDisplay sources={message.metadata.sourcesUsed} />
                )}
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
