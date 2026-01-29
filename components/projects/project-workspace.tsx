"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourcePanel } from "@/components/sources/source-panel";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  FileText,
  MessageSquare,
  Upload,
  History,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { updateProjectDescription } from "@/lib/actions/projects";
import type { Project, Source } from "@/types";
import type { UIMessage } from "ai";

// Metadata type for messages with sources used (matches server-side)
interface MessageMetadata {
  sourcesUsed?: { id: string; title: string }[];
}

type ChatMessage = UIMessage<MessageMetadata>;

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  message_count: number;
}

interface ProjectWorkspaceProps {
  project: Project;
  sources: Source[];
  apiKeys: { id: string; provider: string }[];
  userId: string;
}

export function ProjectWorkspace({
  project,
  sources: initialSources,
  apiKeys,
}: ProjectWorkspaceProps) {
  const availableProviders = apiKeys.map((k) => k.provider);

  // Sources state (allows refresh when AI adds sources)
  const [currentSources, setCurrentSources] = useState<Source[]>(initialSources);

  const refreshSources = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("sources")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (data) {
        setCurrentSources(data as Source[]);
      }
    } catch (err) {
      console.error("Failed to refresh sources:", err);
    }
  }, [project.id]);

  // Chat session state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Project description state
  const [description, setDescription] = useState(project.description || "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState(project.description || "");

  const handleSaveDescription = async () => {
    await updateProjectDescription(project.id, descriptionInput);
    setDescription(descriptionInput);
    setEditingDescription(false);
  };

  const handleCancelDescription = () => {
    setDescriptionInput(description);
    setEditingDescription(false);
  };

  // Generate default description from chat messages if none exists
  const getDefaultDescription = useCallback(() => {
    if (description) return null; // Already has a description
    
    // Get user message topics
    const userMessages = chatMessages
      .filter(m => m.role === "user")
      .map(m => m.parts?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map(p => p.text).join(" ") || "")
      .filter(t => t.length > 0);
    
    if (userMessages.length === 0) return null;
    
    // Clean up the first user message to extract the actual topic
    let topic = userMessages[0]
      // Remove request prefixes
      .replace(/^(please\s+)?(can you\s+)?(create|make|write|generate|give|build|design)\s+(me\s+)?(a\s+)?/i, "")
      .replace(/^(i\s+)?(want|need|would like)\s+(a\s+)?/i, "")
      // Clean up trailing words
      .replace(/\s+(please|thanks|thank you)\.?$/i, "")
      .trim();
    
    // Capitalize first letter
    if (topic.length > 0) {
      topic = topic.charAt(0).toUpperCase() + topic.slice(1);
    }
    
    // Truncate if too long
    if (topic.length > 60) {
      topic = topic.slice(0, 57) + "...";
    }
    
    return topic || null;
  }, [description, chatMessages]);

  const displayDescription = description || getDefaultDescription();
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Fetch chat sessions on mount
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat-sessions?projectId=${project.id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data.sessions || []);
        // Auto-select the most recent session, or none (new chat)
        if (data.sessions?.length > 0 && !activeChatId) {
          const latest = data.sessions[0];
          setActiveChatId(latest.id);
          await loadSessionMessages(latest.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch chat sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat-sessions?sessionId=${sessionId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        // Convert DB messages to ChatMessage format, reconstructing full parts from metadata
        const uiMessages: ChatMessage[] = (data.messages || []).map(
          (m: {
            id: string;
            role: string;
            content: string;
            metadata?: { parts?: UIMessage["parts"]; sourcesUsed?: { id: string; title: string }[] };
            created_at: string;
          }): ChatMessage => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            // Use saved parts from metadata if available, otherwise fall back to text
            parts: m.metadata?.parts || [{ type: "text" as const, text: m.content }],
            // Include sources used for assistant messages in metadata
            metadata: m.role === "assistant" && m.metadata?.sourcesUsed 
              ? { sourcesUsed: m.metadata.sourcesUsed } 
              : undefined,
          })
        );
        setChatMessages(uiMessages);
      }
    } catch (err) {
      console.error("Failed to load session messages:", err);
    }
  };

  const handleChatChange = async (sessionId: string) => {
    setActiveChatId(sessionId);
    await loadSessionMessages(sessionId);
  };

  const handleNewChat = () => {
    setActiveChatId(undefined);
    setChatMessages([]);
  };

  const handleSessionCreated = useCallback((session: { id: string; title: string }) => {
    setChatSessions((prev) => [
      { id: session.id, title: session.title, created_at: new Date().toISOString(), message_count: 0 },
      ...prev,
    ]);
    setActiveChatId(session.id);
  }, []);

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/chat-sessions?id=${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeChatId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Project header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          
          {/* Editable description */}
          {editingDescription ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Add a project description..."
                className="h-7 text-sm max-w-md"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDescription();
                  if (e.key === "Escape") handleCancelDescription();
                }}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveDescription}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelDescription}>
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingDescription(true)}
              className="group flex items-center gap-1.5 mt-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={displayDescription ? "" : "italic"}>
                {displayDescription || "Add description..."}
              </span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </div>

      {/* Split pane: Left (Sources/Documents) | Right (Chat) */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 rounded-lg border">
        {/* LEFT PANEL: Sources & Documents */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex h-full flex-col">
            <Tabs defaultValue="sources" className="flex h-full flex-col">
              <div className="border-b px-3 pt-2">
                <TabsList className="w-fit">
                  <TabsTrigger value="sources" className="gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    Sources ({currentSources.length})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="gap-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5" />
                    Documents
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="sources" className="flex-1 overflow-y-auto p-4 mt-0">
                <SourcePanel projectId={project.id} sources={currentSources} onRefresh={refreshSources} />
              </TabsContent>

              <TabsContent value="documents" className="flex-1 overflow-hidden p-4 mt-0">
                <DocumentsPanel 
                  projectId={project.id} 
                  lastChatPrompt={
                    // Extract last user message text for generate dialog
                    chatMessages
                      .filter(m => m.role === "user")
                      .slice(-1)[0]?.parts
                      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                      .map(p => p.text)
                      .join(" ")
                  }
                />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT PANEL: Chat with history */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex h-full">
            {/* Chat history sidebar (collapsible) */}
            {showHistory && (
              <div className="w-52 border-r bg-muted/30 flex flex-col">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Chat History
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowHistory(false)}
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-1">
                    {/* New chat button */}
                    <button
                      onClick={handleNewChat}
                      className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                        !activeChatId
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      + New Chat
                    </button>

                    {chatSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`group flex items-center rounded-md transition-colors ${
                          session.id === activeChatId
                            ? "bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                      >
                        <button
                          onClick={() => handleChatChange(session.id)}
                          className={`flex-1 truncate px-3 py-2 text-left text-xs ${
                            session.id === activeChatId
                              ? "text-primary font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {session.title}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}

                    {loadingSessions && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Loading...</p>
                    )}
                    {!loadingSessions && chatSessions.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        No past chats yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Main chat area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat header with history toggle */}
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setShowHistory(!showHistory)}
                  title="Chat history"
                >
                  <History className="h-4 w-4" />
                </Button>
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">
                  {activeChatId
                    ? chatSessions.find((s) => s.id === activeChatId)?.title || "Chat"
                    : "New Chat"}
                </span>
              </div>

              {/* Chat interface */}
              <div className="flex-1 overflow-hidden p-3">
                <ChatInterface
                  projectId={project.id}
                  availableProviders={availableProviders}
                  hasSources={currentSources.some((s: Source) => s.status === "ready")}
                  chatId={activeChatId}
                  initialMessages={chatMessages}
                  chatSessions={chatSessions}
                  onChatChange={handleChatChange}
                  onNewChat={handleNewChat}
                  onSessionCreated={handleSessionCreated}
                  onSourceAdded={refreshSources}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
