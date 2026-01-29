import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/projects/project-workspace";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch project
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  // Fetch sources
  const { data: sources } = await supabase
    .from("sources")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Fetch user's API keys (just provider info, not the actual keys)
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, provider")
    .eq("user_id", user.id);

  return (
    <ProjectWorkspace
      project={project}
      sources={sources ?? []}
      apiKeys={apiKeys ?? []}
      userId={user.id}
    />
  );
}
