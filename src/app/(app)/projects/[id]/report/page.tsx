import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportToolbar } from "@/components/app/report-toolbar";
import { auth } from "@/lib/auth";
import { AuthzError, requireProjectAccess } from "@/lib/authz";
import { REPORT_CSS, reportBodyHtml } from "@/lib/report-html";
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

  // The on-screen report is the same document the HTML export downloads. Every value in it
  // is escaped by reportBodyHtml, so it is safe to inject here.
  const html = reportBodyHtml(assessment);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="no-print space-y-1">
        <Link
          href={`/projects/${params.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {assessment.record.projectName}
        </Link>
        <p className="text-sm text-muted-foreground">
          Live report. It is built from the current model each time you open it, and is the same
          document you download. For a frozen, reviewed record, use Review and sign-off.
        </p>
      </div>
      <ReportToolbar projectId={params.id} />
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <article
        aria-label="Threat model report"
        className="report-doc mx-auto max-w-[960px] rounded-sm border shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
