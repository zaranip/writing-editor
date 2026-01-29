"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Home,
  Settings,
  Plus,
  BookOpen,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Project } from "@/types";

interface SidebarProps {
  projects: Project[];
}

export function Sidebar({ projects }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="font-semibold text-lg">WritingEditor</span>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="space-y-1 p-3">
          <Link href="/dashboard">
            <Button
              variant={pathname === "/dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        <Separator />

        {/* Projects */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            Projects
          </span>
          <Link href="/dashboard?new=true">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
              >
                <Button
                  variant={
                    pathname === `/dashboard/projects/${project.id}`
                      ? "secondary"
                      : "ghost"
                  }
                  className="w-full justify-start truncate"
                >
                  <FolderOpen className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{project.title}</span>
                </Button>
              </Link>
            ))}
            {projects.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No projects yet
              </p>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer nav */}
        <div className="space-y-1 p-3">
          <Link href="/dashboard/settings">
            <Button
              variant={pathname === "/dashboard/settings" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
