-- ============================================================
-- WritingEditor Initial Schema
-- ============================================================

-- Enable pgvector extension for embedding storage
create extension if not exists vector with schema extensions;

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- API KEYS (encrypted, per-user, per-provider)
-- ============================================================
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  provider text not null check (provider in ('openai', 'anthropic', 'google')),
  encrypted_key text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, provider)
);

alter table public.api_keys enable row level security;

create policy "Users can manage their own API keys"
  on public.api_keys for all
  using (auth.uid() = user_id);

-- ============================================================
-- PROJECTS (notebook workspaces)
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default 'Untitled Project',
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.projects enable row level security;

create policy "Users can manage their own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- ============================================================
-- SOURCES (uploaded documents, URLs, etc.)
-- ============================================================
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  type text not null check (type in ('pdf', 'text', 'url', 'youtube', 'image')),
  title text not null,
  file_path text,
  original_url text,
  content text,
  metadata jsonb default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.sources enable row level security;

create policy "Users can manage their own sources"
  on public.sources for all
  using (auth.uid() = user_id);

-- ============================================================
-- CHUNKS (text chunks with vector embeddings for RAG)
-- ============================================================
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources on delete cascade not null,
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  chunk_index int not null,
  embedding extensions.vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

alter table public.chunks enable row level security;

create policy "Users can manage their own chunks"
  on public.chunks for all
  using (auth.uid() = user_id);

-- HNSW index for fast similarity search
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ============================================================
-- MESSAGES (chat history per project)
-- ============================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

alter table public.messages enable row level security;

create policy "Users can manage their own messages"
  on public.messages for all
  using (auth.uid() = user_id);

-- ============================================================
-- DOCUMENTS (generated outputs — for Phase 2)
-- ============================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  title text not null default 'Untitled Document',
  type text not null default 'document' check (type in ('document', 'slides')),
  content jsonb not null default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.documents enable row level security;

create policy "Users can manage their own documents"
  on public.documents for all
  using (auth.uid() = user_id);

-- ============================================================
-- SIMILARITY SEARCH FUNCTION (for RAG)
-- ============================================================
create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  match_project_id uuid,
  match_user_id uuid,
  match_count int default 10,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  content text,
  source_id uuid,
  chunk_index int,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.content,
    chunks.source_id,
    chunks.chunk_index,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.chunks
  where chunks.project_id = match_project_id
    and chunks.user_id = match_user_id
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- UPDATED_AT TRIGGER (auto-update updated_at column)
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger api_keys_updated_at before update on public.api_keys
  for each row execute function public.update_updated_at();

create trigger projects_updated_at before update on public.projects
  for each row execute function public.update_updated_at();

create trigger sources_updated_at before update on public.sources
  for each row execute function public.update_updated_at();

create trigger documents_updated_at before update on public.documents
  for each row execute function public.update_updated_at();
