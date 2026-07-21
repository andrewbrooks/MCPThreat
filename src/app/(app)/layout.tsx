import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { auth } from "@/lib/auth";
import { listProjectsForSwitcher } from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await listProjectsForSwitcher(session.user.id);

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      projects={projects}
    >
      {children}
    </AppShell>
  );
}
