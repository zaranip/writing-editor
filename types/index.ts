// ============================================================
// Database types
// ============================================================

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  provider: "openai" | "anthropic" | "google" | "openrouter";
  encrypted_key: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  project_id: string;
  user_id: string;
  type: "pdf" | "text" | "url" | "youtube" | "image";
  title: string;
  file_path: string | null;
  original_url: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  status: "pending" | "processing" | "ready" | "error";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  source_id: string;
  project_id: string;
  user_id: string;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  type: "document" | "slides";
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  project_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// LLM Provider types
// ============================================================

export type LLMProvider = "openai" | "anthropic" | "google" | "openrouter";

export interface ModelOption {
  provider: LLMProvider;
  model: string;
  label: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  // OpenRouter models (access all providers with one key)
  { provider: "openrouter", model: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (via OpenRouter)" },
  { provider: "openrouter", model: "openai/gpt-4o", label: "GPT-4o (via OpenRouter)" },
  { provider: "openrouter", model: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (via OpenRouter)" },
  { provider: "openrouter", model: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku (via OpenRouter)" },
  { provider: "openrouter", model: "openai/gpt-4o-mini", label: "GPT-4o Mini (via OpenRouter)" },
  { provider: "openrouter", model: "deepseek/deepseek-r1", label: "DeepSeek R1 (via OpenRouter)" },
  // Direct provider models
  { provider: "openai", model: "gpt-4o", label: "GPT-4o" },
  { provider: "openai", model: "gpt-4o-mini", label: "GPT-4o Mini" },
  { provider: "anthropic", model: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { provider: "anthropic", model: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  { provider: "google", model: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { provider: "google", model: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
];

// ============================================================
// Source types for upload
// ============================================================

export type SourceType = "pdf" | "text" | "url" | "youtube" | "image";

export interface UploadedSource {
  file?: File;
  url?: string;
  type: SourceType;
  title: string;
}

// ============================================================
// RAG types
// ============================================================

export interface RetrievedChunk {
  id: string;
  content: string;
  source_id: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
  similarity: number;
  source_title?: string;
}
