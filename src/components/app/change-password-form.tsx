"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters.", "error");
      return;
    }
    if (newPassword !== confirm) {
      toast("Passwords do not match.", "error");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        hasPassword ? { currentPassword, newPassword } : { newPassword },
      ),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(data.error ?? "Failed to change password.", "error");
      return;
    }
    toast("Password updated.", "success");
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  return (
    <div className="space-y-4">
      {hasPassword ? (
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your account signs in with an OAuth provider. Set a password to also enable
          email/password sign-in.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? "Updating…" : hasPassword ? "Change password" : "Set password"}
      </Button>
    </div>
  );
}
