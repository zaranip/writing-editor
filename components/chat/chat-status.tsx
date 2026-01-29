"use client";

import { Loader2, Brain, Globe, BookOpen, BookPlus, CheckCircle2 } from "lucide-react";
import type { UIMessage } from "ai";

interface ChatStatusProps {
  status: string;
  messages: UIMessage[];
}

interface ToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  state: string;
}

/**
 * Sticky status bar that shows the AI's current thought process.
 * Displays what tools are being used in real-time.
 */
export function ChatStatus({ status, messages }: ChatStatusProps) {
  const isActive = status === "streaming" || status === "submitted";
  if (!isActive) return null;

  // Find the latest assistant message to check for active tool invocations
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const activeTools = extractActiveTools(lastAssistantMsg);

  // Determine what to show
  const steps = buildSteps(activeTools, status);

  if (steps.length === 0) return null;

  return (
    <div className="border-b bg-muted/30 px-4 py-2 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="shrink-0">{step.icon}</span>
            <span className={`${step.done ? "text-muted-foreground" : "text-foreground font-medium"}`}>
              {step.label}
            </span>
            {step.detail && (
              <span className="text-muted-foreground truncate max-w-[300px]">
                {step.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Step {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  done: boolean;
}

function extractActiveTools(message: UIMessage | undefined): ToolInvocation[] {
  if (!message?.parts) return [];
  const tools: ToolInvocation[] = [];
  for (const part of message.parts) {
    if (part.type === "tool-invocation") {
      const inv = (part as unknown as { toolInvocation: ToolInvocation }).toolInvocation;
      if (inv) tools.push(inv);
    }
  }
  return tools;
}

function buildSteps(tools: ToolInvocation[], status: string): Step[] {
  const steps: Step[] = [];

  if (tools.length === 0) {
    // No tools yet — AI is thinking
    steps.push({
      icon: <Brain className="h-3.5 w-3.5 text-violet-500 animate-pulse" />,
      label: "Thinking...",
      done: false,
    });
    return steps;
  }

  for (const tool of tools) {
    const done = tool.state === "result";
    const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
    const check = <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;

    switch (tool.toolName) {
      case "webSearch":
        steps.push({
          icon: done ? check : spinner,
          label: done ? "Searched the web" : "Searching the web...",
          detail: `"${String(tool.args.query || "")}"`,
          done,
        });
        break;
      case "readWebPage":
        steps.push({
          icon: done ? check : <BookOpen className="h-3.5 w-3.5 text-orange-500 animate-pulse" />,
          label: done ? "Read web page" : "Reading web page...",
          detail: String(tool.args.url || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0],
          done,
        });
        break;
      case "addToSources":
        steps.push({
          icon: done ? check : <BookPlus className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />,
          label: done ? "Added to sources" : "Adding to sources...",
          detail: String(tool.args.title || ""),
          done,
        });
        break;
      default:
        steps.push({
          icon: done ? check : spinner,
          label: done ? `Used ${tool.toolName}` : `Running ${tool.toolName}...`,
          done,
        });
    }
  }

  // If the last tool is done and status is still streaming, the AI is composing its response
  const lastTool = tools[tools.length - 1];
  if (lastTool?.state === "result" && status === "streaming") {
    steps.push({
      icon: <Brain className="h-3.5 w-3.5 text-violet-500 animate-pulse" />,
      label: "Composing response...",
      done: false,
    });
  }

  return steps;
}
