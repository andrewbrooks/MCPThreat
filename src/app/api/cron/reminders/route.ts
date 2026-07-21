import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { buildFindingEmail, isEmail, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// Dispatches due recurring owner reminders. Meant to be hit on a schedule by an
// external cron (e.g. Vercel Cron, a GitHub Action, or `curl` in a system cron),
// authenticated with the CRON_SECRET bearer token. Findings are only reminded while
// still open (OPEN / IN_PROGRESS); each send advances reminderNextAt by the interval.
async function run(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization");
  const provided = header?.startsWith("Bearer ")
    ? header.slice(7)
    : new URL(req.url).searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.finding.findMany({
    where: {
      reminderIntervalDays: { not: null },
      reminderNextAt: { not: null, lte: now },
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    include: { project: { select: { name: true } } },
  });

  let sent = 0;
  let skipped = 0;
  for (const f of due) {
    const owner = f.owner.trim();
    const interval = f.reminderIntervalDays ?? 0;
    const emailable = isEmail(owner);

    if (emailable) {
      const message = buildFindingEmail({
        projectId: f.projectId,
        projectName: f.project.name,
        finding: {
          title: f.title,
          severity: f.severity,
          status: f.status,
          description: f.description,
          recommendation: f.recommendation,
          dueDate: f.dueDate,
        },
        kind: "reminder",
        intervalDays: interval,
      });
      await sendEmail({ ...message, to: owner });
      await recordAudit({
        projectId: f.projectId,
        findingId: f.id,
        actorLabel: "system",
        action: "REMINDER_SENT",
        detail: `Reminder emailed to ${owner}`,
      });
      sent += 1;
    } else {
      skipped += 1;
    }

    // Advance the schedule regardless so we don't loop on the same finding.
    await prisma.finding.update({
      where: { id: f.id },
      data: {
        reminderNextAt: new Date(now.getTime() + interval * 24 * 60 * 60 * 1000),
        ...(emailable ? { lastAlertAt: now } : {}),
      },
    });
  }

  return NextResponse.json({ processed: due.length, sent, skipped });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
