import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/app/report-view";
import { auth } from "@/lib/auth";
import { AuthzError, requireProjectAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { buildReportData, generateReport, type ReportProject } from "@/lib/report";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    await requireProjectAccess(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AuthzError) notFound();
    throw err;
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      findings: true,
      threatModel: {
        include: {
          boundaries: {
            orderBy: { createdAt: "asc" },
            include: { vectors: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const reportInput: ReportProject = {
    name: project.name,
    description: project.description,
    mcpServerUrl: project.mcpServerUrl,
    architecture: project.architecture,
    status: project.status,
    boundaries: project.threatModel?.boundaries ?? [],
    findings: project.findings,
  };
  const markdown = generateReport(reportInput);
  const data = buildReportData(reportInput);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Threat Model Report</h1>
        <p className="text-sm text-muted-foreground">
          Generated from the current threat model. Copy the markdown or export to PDF.
        </p>
      </div>
      <ReportView data={data} markdown={markdown} />
    </div>
  );
}
