"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export function ProfileEditor({
  initial,
}: {
  initial: { name: string; email: string; image: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initial.name);
  const [image, setImage] = useState(initial.image);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, image }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(data.error ?? "Failed to save profile.", "error");
      return;
    }
    toast("Profile updated.", "success");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={initial.email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="image">Avatar URL</Label>
        <Input
          id="image"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}
