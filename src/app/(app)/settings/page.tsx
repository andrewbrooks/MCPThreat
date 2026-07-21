import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { MembersManager } from "@/components/app/members-manager";
import { ProfileEditor } from "@/components/app/profile-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, passwordHash: true },
  });
  const hasPassword = Boolean(user?.passwordHash);

  // Only projects the user owns can have members managed here.
  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and project members.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEditor
            initial={{
              name: user?.name ?? "",
              email: user?.email ?? "",
              image: user?.image ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {hasPassword
              ? "Change the password you use to sign in."
              : "Set a password to enable email/password sign-in."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm hasPassword={hasPassword} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Members</CardTitle>
          <CardDescription>Invite teammates to your projects by email.</CardDescription>
        </CardHeader>
        <CardContent>
          <MembersManager projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
