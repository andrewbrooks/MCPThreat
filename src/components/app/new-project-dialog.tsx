"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createProjectSchema } from "@/lib/validators";

type FormValues = z.infer<typeof createProjectSchema>;

export function NewProjectDialog({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "", mcpServerUrl: "", architecture: "" },
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error ?? "Failed to create project.", "error");
      return;
    }
    toast("Project created.", "success");
    setOpen(false);
    reset();
    router.push(`/projects/${data.project.id}/model`);
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New Project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a threat model for an MCP server deployment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Payment MCP Server" {...register("name")} />
            {errors.name ? <p className="text-xs text-red-600 dark:text-red-400">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What does this MCP server do?"
              {...register("description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcpServerUrl">MCP Server URL (optional)</Label>
            <Input
              id="mcpServerUrl"
              placeholder="https://mcp.example.com"
              {...register("mcpServerUrl")}
            />
            {errors.mcpServerUrl ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.mcpServerUrl.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="architecture">Architecture Notes (optional)</Label>
            <Textarea
              id="architecture"
              placeholder="Transports, downstream services, tenancy model…"
              {...register("architecture")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
