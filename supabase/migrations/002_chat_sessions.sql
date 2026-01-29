-- ============================================================
-- CHAT SESSIONS (conversation threads per project)
-- ============================================================
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  title text not null default 'New Chat',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.chat_sessions enable row level security;

create policy "Users can manage their own chat sessions"
  on public.chat_sessions for all
  using (auth.uid() = user_id);

create trigger chat_sessions_updated_at before update on public.chat_sessions
  for each row execute function public.update_updated_at();

-- ============================================================
-- CHAT MESSAGES (messages within a chat session)
-- ============================================================
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_session_id uuid references public.chat_sessions on delete cascade not null,
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

alter table public.chat_messages enable row level security;

create policy "Users can manage their own chat messages"
  on public.chat_messages for all
  using (auth.uid() = user_id);

-- Index for efficient session message loading
create index chat_messages_session_idx on public.chat_messages (chat_session_id, created_at);
create index chat_sessions_project_idx on public.chat_sessions (project_id, updated_at desc);
