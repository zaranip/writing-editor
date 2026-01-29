"use client";

import { Loader2, Brain, Globe, BookOpen, BookPlus, CheckCircle2 } from "lucide-react";
import type { UIMessage } from "ai";

interface ChatStatusProps {
  status: string;
  messages: UIMessage[];
}

// AI SDK v6: static tools have type "tool-{name}", dynamic tools have type "dynamic-tool"
interface ToolInfo {
  toolName: string;
  input?: Record<string, unknown>;
  state: string;
}

// Helper to check if a part is a tool invocation
function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

// Extract tool name from part
function getToolName(part: { type: string; toolName?: string }): string {
  if (part.type === "dynamic-tool") {
    return part.toolName || "unknown";
  }
  return part.type.replace(/^tool-/, "");
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

function isToolOutputReady(state: string): boolean {
  return state === "output-available" || state === "output-error" || state === "output-denied";
}

function extractActiveTools(message: UIMessage | undefined): ToolInfo[] {
  if (!message?.parts) return [];
  const tools: ToolInfo[] = [];
  for (const part of message.parts) {
    if (isToolPart(part)) {
      const toolPart = part as unknown as { type: string; toolName?: string; input: Record<string, unknown>; state: string };
      tools.push({
        toolName: getToolName(toolPart),
        input: toolPart.input,
        state: toolPart.state,
      });
    }
  }
  return tools;
}

function buildSteps(tools: ToolInfo[], status: string): Step[] {
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
    const done = isToolOutputReady(tool.state);
    const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
    const check = <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;

    switch (tool.toolName) {
      case "webSearch":
        steps.push({
          icon: done ? check : spinner,
          label: done ? "Searched the web" : "Searching the web...",
          detail: tool.input?.query ? `"${String(tool.input.query)}"` : undefined,
          done,
        });
        break;
      case "readWebPage":
        steps.push({
          icon: done ? check : <BookOpen className="h-3.5 w-3.5 text-orange-500 animate-pulse" />,
          label: done ? "Read web page" : "Reading web page...",
          detail: tool.input?.url ? String(tool.input.url).replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : undefined,
          done,
        });
        break;
      case "addToSources":
        steps.push({
          icon: done ? check : <BookPlus className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />,
          label: done ? "Added to sources" : "Adding to sources...",
          detail: tool.input?.title ? String(tool.input.title) : undefined,
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
  if (isToolOutputReady(lastTool?.state) && status === "streaming") {
    steps.push({
      icon: <Brain className="h-3.5 w-3.5 text-violet-500 animate-pulse" />,
      label: "Composing response...",
      done: false,
    });
  }

  return steps;
}
