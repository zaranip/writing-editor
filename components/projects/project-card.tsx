"use client";

import Link from "next/link";
import { FolderOpen, Trash2, MoreVertical } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteProject } from "@/lib/actions/projects";
import type { Project } from "@/types";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  async function handleDelete() {
    if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      await deleteProject(project.id);
    }
  }

  return (
    <Card className="group relative transition-colors hover:bg-accent/50">
      <Link href={`/dashboard/projects/${project.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{project.title}</CardTitle>
                <CardDescription className="mt-1">
                  {project.description || "No description"}
                </CardDescription>
              </div>
            </div>
          </div>
          <CardDescription className="mt-3 text-xs">
            Updated {new Date(project.updated_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
      </Link>

      {/* Actions dropdown — positioned absolute to avoid blocking the Link */}
      <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
