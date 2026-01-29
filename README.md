# Writing Editor

An AI-powered research and writing platform. Turn scattered sources into polished documents and presentations.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fwriting-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is Writing Editor?

Writing Editor is an open-source research assistant that helps you gather sources, chat with AI about your research, and generate professional documents and presentations — all in one place.

**The workflow:**
1. **Add sources** — Upload PDFs, paste URLs, add YouTube videos, or drop images
2. **Research with AI** — Chat with an AI that can search the web, read pages, and automatically save useful sources
3. **Generate documents** — Turn your research into polished documents or slide presentations with one click
4. **Export anywhere** — Download as PDF, DOCX, or PPTX

---

## How is this different from NotebookLM?

| Feature | Writing Editor | NotebookLM |
|---------|---------------|------------|
| **Open source** | Yes — self-host, modify, own your data | No |
| **Bring your own API keys** | Use OpenAI, Anthropic, or Google — your choice | Locked to Google |
| **Web research** | AI can search the web and add sources automatically | Limited to uploaded sources |
| **Document generation** | Built-in rich text editor + export to PDF/DOCX/PPTX | Audio summaries only |
| **Presentation creation** | Generate slide decks with images from sources | No |
| **Self-hostable** | Deploy to Vercel for free | No |
| **Data privacy** | Your Supabase instance, your data | Google's servers |
| **Cost** | Free (you pay only for AI API usage) | Free with limits |

**In short:** NotebookLM is great for audio summaries of uploaded documents. Writing Editor is for researchers and writers who need to produce actual deliverables — documents, reports, and presentations — from diverse sources including live web research.

---

## Features

- **Multi-source research** — PDFs, URLs, YouTube transcripts, images, plain text
- **AI chat with tools** — Web search, page reading, automatic source saving
- **Smart context** — AI responses cite your sources with `[Source N]` notation
- **Document editor** — Rich text editing with TipTap
- **Presentation editor** — Create and edit slide decks with image support
- **Export formats** — PDF, DOCX, PPTX
- **Project organization** — Keep research organized by project
- **Chat history** — Multiple chat sessions per project
- **Dark mode** — Full dark/light theme support
- **Provider agnostic** — Works with OpenAI, Anthropic, or Google AI

---

## Self-Hosting Guide

Writing Editor can be deployed for free using Vercel (hosting) and Supabase (database + auth + storage).

### Prerequisites

- GitHub account
- [Vercel account](https://vercel.com) (free)
- [Supabase account](https://supabase.com) (free)
- At least one AI API key (OpenAI, Anthropic, or Google)

---

### Step 1: Set Up Supabase

#### 1.1 Create a new Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose a name, password, and region
4. Wait for the project to be created

#### 1.2 Run the database migrations

Go to **SQL Editor** in your Supabase dashboard and run each of these:

<details>
<summary><strong>Migration 1: Core tables</strong></summary>

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sources table
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'url', 'youtube', 'text', 'image')),
  title TEXT NOT NULL,
  content TEXT,
  original_url TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  type TEXT NOT NULL DEFAULT 'document' CHECK (type IN ('document', 'slides')),
  content JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys table (encrypted storage)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own projects" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own sources" ON sources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own documents" ON documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own chat sessions" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own chat messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own API keys" ON api_keys FOR ALL USING (auth.uid() = user_id);
```

</details>

<details>
<summary><strong>Migration 2: Storage bucket</strong></summary>

```sql
-- Create sources storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sources', 'sources', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload source files" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'sources' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view source files" ON storage.objects 
  FOR SELECT USING (bucket_id = 'sources');

CREATE POLICY "Users can update source files" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'sources' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete source files" ON storage.objects 
  FOR DELETE USING (bucket_id = 'sources' AND auth.role() = 'authenticated');
```

</details>

#### 1.3 Enable Google OAuth (optional but recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and go to **APIs & Services → Credentials**
3. Create an **OAuth 2.0 Client ID** (Web application)
4. Add redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. In Supabase: Go to **Authentication → Providers → Google**
6. Enable Google and paste your Client ID and Client Secret

#### 1.4 Get your Supabase credentials

Go to **Settings → API** and copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

---

### Step 2: Deploy to Vercel

#### 2.1 Fork or clone this repository

```bash
git clone https://github.com/yourusername/writing-editor.git
```

#### 2.2 Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your repository
3. Add environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `API_KEY_ENCRYPTION_SECRET` | A random 32-character string* |

*Generate with: `openssl rand -hex 16`

4. Click **Deploy**

#### 2.3 Update Supabase auth settings

After deployment, go to Supabase **Authentication → URL Configuration**:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: Add `https://your-app.vercel.app/**`

---

### Step 3: Add your AI API keys

1. Open your deployed app
2. Sign in with Google (or email)
3. Go to **Settings** (gear icon)
4. Add at least one API key:
   - [OpenAI API key](https://platform.openai.com/api-keys)
   - [Anthropic API key](https://console.anthropic.com/)
   - [Google AI API key](https://makersuite.google.com/app/apikey)

You're ready to go!

---

## Local Development

```bash
# Clone the repo
git clone https://github.com/yourusername/writing-editor.git
cd writing-editor

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `API_KEY_ENCRYPTION_SECRET` | Yes | 32-char secret for encrypting user API keys |

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Storage)
- **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/)
- **Editor**: [TipTap](https://tiptap.dev/)
- **UI**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Export**: [jsPDF](https://github.com/parallax/jsPDF), [docx](https://github.com/dolanmiu/docx), [PptxGenJS](https://github.com/gitbrent/PptxGenJS)

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), [Vercel AI SDK](https://sdk.vercel.ai/), and [shadcn/ui](https://ui.shadcn.com/).
