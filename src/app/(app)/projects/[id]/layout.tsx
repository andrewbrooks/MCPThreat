import { notFound, redirect } from "next/navigation";
import { StageBar } from "@/components/app/stage-bar";
import { auth } from "@/lib/auth";
import { AuthzError, requireProjectAccess } from "@/lib/authz";
import { loadProjectWorkflow } from "@/lib/readiness-loader";
import type { Readiness } from "@/lib/workflow-types";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    await requireProjectAccess(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AuthzError) notFound();
    throw err;
  }

  let readiness: Readiness | null = null;
  try {
    readiness = (await loadProjectWorkflow(params.id))?.readiness ?? null;
  } catch {
    readiness = null;
  }

  return (
    <>
      {readiness ? <StageBar projectId={params.id} readiness={readiness} /> : null}
      {children}
    </>
  );
}
