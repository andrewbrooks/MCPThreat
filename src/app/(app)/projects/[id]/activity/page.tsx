import { History } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { auth } from "@/lib/auth";
import { AuthzError, requireProjectAccess } from "@/lib/authz";
import { describeAuditEvent } from "@/lib/audit-format";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let project;
  try {
    const access = await requireProjectAccess(session.user.id, params.id);
    project = access.project;
  } catch (err) {
    if (err instanceof AuthzError) notFound();
    throw err;
  }
  if (!project) notFound();

  const events = await prisma.auditEvent.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 [&>*]:max-w-4xl">
      <PageHeader
        back={{ href: `/projects/${params.id}`, label: project.name }}
        title="Activity"
        description="A complete audit trail of changes: who did what, and when."
      />

      {events.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Finding changes, status updates, evidence edits, attachments, and alerts will appear here."
        />
      ) : (
        <ol className="space-y-3 border-l pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[1.4rem] top-1.5 size-2 rounded-full bg-border" />
              <div className="text-sm">
                <span className="font-medium">{e.actorLabel}</span>{" "}
                <span className="text-muted-foreground">{describeAuditEvent(e)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
