import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/app/report-view";
import { auth } from "@/lib/auth";
import { AuthzError, requireProjectAccess } from "@/lib/authz";
import { loadAssessment } from "@/lib/report-loader";

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

  const assessment = await loadAssessment(params.id);
  if (!assessment) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print">
        <Link
          href={`/projects/${params.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {assessment.record.projectName}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Threat Model Report</h1>
        <p className="text-sm text-muted-foreground">
          Built from the current threat model each time you open it. Download it as HTML, Markdown,
          JSON, or a findings CSV, or print it to PDF.
        </p>
      </div>
      <ReportView data={assessment} />
    </div>
  );
}
