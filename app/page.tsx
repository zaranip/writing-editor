import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Upload,
  MessageSquare,
  FileText,
  ArrowRight,
  Brain,
  Sparkles,
  Download,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">WritingEditor</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Research smarter.
          <br />
          <span className="text-primary">Write better.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Upload your research sources, chat with AI to analyze and synthesize
          them, then generate and edit polished documents and presentations
          &mdash; all in one workspace.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">
            Everything you need for AI-powered research
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Combine the research power of NotebookLM with the editing flexibility
            of Google Docs.
          </p>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Upload className="h-6 w-6" />}
              title="Multi-Source Ingestion"
              description="Upload PDFs, paste URLs, add YouTube videos, or import images. All sources are parsed, chunked, and embedded for AI retrieval."
            />
            <FeatureCard
              icon={<Brain className="h-6 w-6" />}
              title="RAG-Powered Chat"
              description="Ask questions about your sources and get accurate, citation-backed answers using retrieval-augmented generation."
            />
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title="Multi-Model AI"
              description="Choose from OpenAI GPT-4o, Anthropic Claude, or Google Gemini. Use your own API keys with full control."
            />
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="Editable Outputs"
              description="Generate documents and slides from your research, then fine-tune every detail in a rich text editor."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">How it works</h2>

          <div className="mt-16 grid gap-12 md:grid-cols-3">
            <Step
              number="1"
              icon={<Upload className="h-5 w-5" />}
              title="Upload your sources"
              description="Add PDFs, web articles, YouTube videos, and images. Our pipeline extracts and indexes all content automatically."
            />
            <Step
              number="2"
              icon={<MessageSquare className="h-5 w-5" />}
              title="Chat with AI"
              description="Ask questions, request summaries, or explore connections across your sources. The AI cites every claim."
            />
            <Step
              number="3"
              icon={<Download className="h-5 w-5" />}
              title="Generate & export"
              description="Turn your research into polished documents or slide decks. Edit inline, then export to PDF, DOCX, or PPTX."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-primary py-16 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to transform your research?</h2>
          <p className="mt-4 text-primary-foreground/80">
            Create your free account and start building your first AI-powered
            research workspace.
          </p>
          <Link href="/signup">
            <Button
              size="lg"
              variant="secondary"
              className="mt-8 gap-2"
            >
              Get started now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} WritingEditor. Built with Next.js,
          Supabase, and the Vercel AI SDK.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
        {number}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
