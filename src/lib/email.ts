import nodemailer, { type Transporter } from "nodemailer";
import {
  SEVERITY_LABELS,
  STATUS_LABELS,
  type Severity,
  type FindingStatus,
} from "@/lib/taxonomy";

// Email delivery. Uses SMTP when SMTP_HOST is configured; otherwise falls back to a
// console "log" transport so the feature works in development without failing.

const FROM = process.env.EMAIL_FROM || "MCPThreat <no-reply@mcpthreat.local>";

let cached: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) {
    cached = null;
    return cached;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return cached;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailTransport = "smtp" | "log";

export async function sendEmail(
  msg: EmailMessage,
): Promise<{ delivered: boolean; transport: EmailTransport }> {
  const transporter = getTransporter();
  if (!transporter) {
    console.info(
      `[email:log] (no SMTP configured)\n  to: ${msg.to}\n  subject: ${msg.subject}\n  ${msg.text.replace(/\n/g, "\n  ")}`,
    );
    return { delivered: false, transport: "log" };
  }
  await transporter.sendMail({ from: FROM, ...msg });
  return { delivered: true, transport: "smtp" };
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function appUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
}

export interface FindingEmailInput {
  projectId: string;
  projectName: string;
  finding: {
    title: string;
    severity: string;
    status: string;
    description: string;
    recommendation: string;
    dueDate: Date | null;
  };
  kind: "alert" | "reminder";
  intervalDays?: number | null;
}

/** Build the alert/reminder email for a finding owner. */
export function buildFindingEmail(input: FindingEmailInput): EmailMessage {
  const { finding, projectName, projectId, kind } = input;
  const sev = SEVERITY_LABELS[finding.severity as Severity] ?? finding.severity;
  const status = STATUS_LABELS[finding.status as FindingStatus] ?? finding.status;
  const link = `${appUrl()}/projects/${projectId}/findings`;
  const due = finding.dueDate
    ? new Date(finding.dueDate).toISOString().slice(0, 10)
    : "none";

  const heading =
    kind === "reminder"
      ? `Reminder: open finding assigned to you in ${projectName}`
      : `Action needed: finding assigned to you in ${projectName}`;

  const lines = [
    heading,
    "",
    `Finding:   ${finding.title}`,
    `Severity:  ${sev}`,
    `Status:    ${status}`,
    `Due date:  ${due}`,
    "",
    finding.description ? `Details: ${finding.description}` : "",
    finding.recommendation ? `Recommendation: ${finding.recommendation}` : "",
    "",
    `Review and update this finding: ${link}`,
    input.kind === "reminder" && input.intervalDays
      ? `\nYou are receiving this reminder every ${input.intervalDays} days until the finding is resolved.`
      : "",
  ].filter((l) => l !== "");

  return {
    to: "", // set by caller
    subject: `[MCPThreat] ${sev} finding — ${finding.title}`,
    text: lines.join("\n"),
  };
}
