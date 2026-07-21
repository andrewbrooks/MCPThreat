import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildDemoContent } from "./demo-repo";

const prisma = new PrismaClient();

// Demo credentials for local development only.
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";
// A second account on the client side, for demonstrating dual acceptance sign-off.
const CLIENT_EMAIL = "client@example.com";

type VectorSeed = {
  key: string;
  title: string;
  description: string;
  strideCategory: string;
  mcpCategory: string;
  likelihood: string;
  impact: string;
};

type BoundarySeed = {
  label: string;
  type: string;
  description: string;
  vectors: VectorSeed[];
};

const boundaries: BoundarySeed[] = [
  {
    label: "Agent → Payment MCP Server",
    type: "LLM_TO_MCP",
    description:
      "The boundary where the LLM agent issues tool calls to the payment MCP server. Requests originate from model reasoning that may be influenced by untrusted context.",
    vectors: [
      {
        key: "priv-esc",
        title: "LLM privilege escalation to higher-privilege tools",
        description:
          "A compromised or manipulated agent invokes refund/payout tools it should not reach, exploiting the server acting with broad ambient authority rather than the requesting user's scope.",
        strideCategory: "ELEVATION_OF_PRIVILEGE",
        mcpCategory: "CONFUSED_DEPUTY",
        likelihood: "MEDIUM",
        impact: "HIGH",
      },
      {
        key: "agent-loop",
        title: "Recursive agent loop causing denial of service",
        description:
          "An agent enters a self-referential tool-calling loop (e.g. retrying a failed charge), exhausting rate limits, worker threads, and downstream quotas.",
        strideCategory: "DOS",
        mcpCategory: "OTHER",
        likelihood: "MEDIUM",
        impact: "MEDIUM",
      },
    ],
  },
  {
    label: "Payment MCP Server → Downstream APIs",
    type: "MCP_TO_TOOL",
    description:
      "The boundary where the MCP server calls downstream payment processors, ledgers, and internal services on behalf of a tool invocation.",
    vectors: [
      {
        key: "token-pass",
        title: "Token passthrough to unintended downstream services",
        description:
          "The server forwards a client-supplied token to downstream APIs without validating that the token was issued for the server, bypassing audience checks and audit trails.",
        strideCategory: "INFO_DISCLOSURE",
        mcpCategory: "TOKEN_PASSTHROUGH",
        likelihood: "MEDIUM",
        impact: "HIGH",
      },
      {
        key: "ssrf",
        title: "SSRF via tool-supplied URLs",
        description:
          "A tool accepts a URL argument (e.g. webhook or receipt endpoint) and the server fetches it, allowing requests to internal services or the cloud metadata endpoint.",
        strideCategory: "DOS",
        mcpCategory: "SSRF",
        likelihood: "HIGH",
        impact: "HIGH",
      },
    ],
  },
  {
    label: "Payment MCP Server → User / Client Session",
    type: "MCP_TO_USER",
    description:
      "The boundary where the server establishes and maintains client sessions and returns results to the end user.",
    vectors: [
      {
        key: "rogue-server",
        title: "Rogue server registration via weak session binding",
        description:
          "Guessable session IDs and sessions not bound to user identity let an attacker register or impersonate a server/session and act as another user.",
        strideCategory: "SPOOFING",
        mcpCategory: "ROGUE_SERVER",
        likelihood: "MEDIUM",
        impact: "HIGH",
      },
      {
        key: "context-bleed",
        title: "Context bleed between tenant sessions",
        description:
          "Shared queues or caches keyed only by session ID leak one tenant's data, tools, or events into another tenant's session.",
        strideCategory: "INFO_DISCLOSURE",
        mcpCategory: "MULTI_TENANCY",
        likelihood: "LOW",
        impact: "HIGH",
      },
    ],
  },
  {
    label: "Tool Output → Agent Context",
    type: "TOOL_OUTPUT_TO_LLM",
    description:
      "The boundary where tool results and retrieved documents flow back into the LLM context, where they may be interpreted as instructions.",
    vectors: [
      {
        key: "tool-poison",
        title: "Tool poisoning via schema injection",
        description:
          "Malicious instructions embedded in a tool's description or parameter JSON schema manipulate the agent into unsafe behavior. The whole schema is an injection surface.",
        strideCategory: "TAMPERING",
        mcpCategory: "TOOL_POISONING",
        likelihood: "MEDIUM",
        impact: "HIGH",
      },
      {
        key: "prompt-inject",
        title: "Prompt injection via RAG/retrieved documents",
        description:
          "Attacker-controlled content in retrieved documents carries instructions that redirect the agent when the documents are pulled into context.",
        strideCategory: "TAMPERING",
        mcpCategory: "PROMPT_INJECTION",
        likelihood: "HIGH",
        impact: "MEDIUM",
      },
      {
        key: "cred-exfil",
        title: "Credential exfiltration via tool output",
        description:
          "Sensitive data (API keys, PANs) is encoded into a tool's output or a follow-up tool argument, smuggling it out through a legitimate channel.",
        strideCategory: "INFO_DISCLOSURE",
        mcpCategory: "DATA_EXFILTRATION",
        likelihood: "MEDIUM",
        impact: "HIGH",
      },
    ],
  },
  {
    label: "External / Third-Party Server Packages",
    type: "EXTERNAL",
    description:
      "The boundary where third-party MCP server packages and their updates are trusted and installed.",
    vectors: [
      {
        key: "rug-pull",
        title: "Rug-pull supply chain update",
        description:
          "A previously approved server ships an update that silently changes tool definitions to malicious behavior after the initial trust decision.",
        strideCategory: "TAMPERING",
        mcpCategory: "SUPPLY_CHAIN",
        likelihood: "LOW",
        impact: "HIGH",
      },
    ],
  },
];

type FindingSeed = {
  vectorKey: string;
  title: string;
  description: string;
  recommendation: string;
  severity: string;
  status: string;
  owner: string;
  dueInDays: number | null;
  evidence: string;
  reviewIntervalDays?: number | null;
  reminderIntervalDays?: number | null;
};

const findings: FindingSeed[] = [
  {
    vectorKey: "tool-poison",
    title: "Tool schemas are not pinned or hash-verified",
    description:
      "Tool descriptions and parameter schemas are consumed as-is at runtime with no integrity check, leaving the agent open to injected instructions.",
    recommendation:
      "Pin tool definitions at discovery with SHA-256, re-hash before execution and alert on drift. Enforce strict JSON Schema with additionalProperties: false.",
    severity: "CRITICAL",
    status: "OPEN",
    owner: "security@example.com",
    dueInDays: 14,
    evidence: "Runtime capture shows tool descriptions passed to the model without validation.",
  },
  {
    vectorKey: "token-pass",
    title: "Client tokens forwarded to processor without audience validation",
    description:
      "The server relays the client's bearer token to the payment processor without checking the token audience.",
    recommendation:
      "Never accept tokens not issued to the server. Validate the audience claim and issue the server its own scoped downstream credentials.",
    severity: "HIGH",
    status: "IN_PROGRESS",
    owner: "platform@example.com",
    dueInDays: 30,
    evidence: "Code review of downstream.ts confirms Authorization header is passed through verbatim.",
    reminderIntervalDays: 14,
  },
  {
    vectorKey: "ssrf",
    title: "Webhook URL parameter fetched without allowlist",
    description:
      "The receipt-webhook tool fetched arbitrary URLs, including internal ranges, before remediation.",
    recommendation:
      "Enforce HTTPS, block private/reserved ranges and 169.254.169.254, validate redirect targets, and pin DNS between check and use.",
    severity: "HIGH",
    status: "MITIGATED",
    owner: "platform@example.com",
    dueInDays: -5,
    evidence: "Egress allowlist and private-range blocklist deployed in v2.3.1; verified against metadata endpoint.",
  },
  {
    vectorKey: "rogue-server",
    title: "Session IDs are sequential and not bound to user identity",
    description:
      "Session identifiers are incremental integers and sessions are treated as authentication on their own.",
    recommendation:
      "Use cryptographically random session IDs, key session storage by <user_id>:<session_id>, and verify authorization on every request.",
    severity: "MEDIUM",
    status: "OPEN",
    owner: "",
    dueInDays: 45,
    evidence: "Observed session IDs 1001, 1002, 1003 across test connections.",
  },
  {
    vectorKey: "cred-exfil",
    title: "No egress logging or PII redaction on tool outputs",
    description:
      "Tool outputs are returned to the model with no centralized logging or secret/PII redaction, enabling covert exfiltration.",
    recommendation:
      "Centrally log all tool invocations with parameters into a SIEM, redact secrets/PII, and require human approval for data-sharing operations.",
    severity: "CRITICAL",
    status: "ACCEPTED",
    owner: "ciso@example.com",
    dueInDays: null,
    evidence: "Risk formally accepted for Q3 pending SIEM rollout; compensating manual review in place.",
    reviewIntervalDays: 90,
  },
  {
    vectorKey: "agent-loop",
    title: "No recursion depth or per-session call quota",
    description:
      "A retry loop in the charge tool could recurse without bound, exhausting downstream quotas.",
    recommendation:
      "Bound tool-call depth and recursion, enforce per-session quotas and timeouts, and add circuit breakers on downstream failures.",
    severity: "LOW",
    status: "CLOSED",
    owner: "platform@example.com",
    dueInDays: -20,
    evidence: "Depth cap (max 5) and per-session rate limit shipped in v2.2.0; load test confirms no runaway.",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_EMAIL, name: "Demo User", passwordHash },
  });
  const clientUser = await prisma.user.upsert({
    where: { email: CLIENT_EMAIL },
    update: { passwordHash },
    create: { email: CLIENT_EMAIL, name: "Client Risk Owner", passwordHash },
  });

  // Reset the example project so re-seeding is idempotent (cascades to all children).
  await prisma.project.deleteMany({
    where: { ownerId: user.id, name: "Example Payment MCP" },
  });

  // Architecture, tech stack, and dataflow are derived from the bundled demo
  // server at demo/payment-mcp-server (SBOM generated from its package.json).
  const demo = buildDemoContent();

  const project = await prisma.project.create({
    data: {
      name: "Example Payment MCP",
      description:
        "A sample threat model for a payment-processing MCP server exposing charge, refund, and receipt tools to an LLM agent.",
      mcpServerUrl: "https://payments.example.com/mcp",
      architecture: demo.architecture,
      techStack: demo.techStack,
      analyzedAt: new Date(),
      status: "ACTIVE",
      acceptancePolicy: "DUAL",
      ownerId: user.id,
      members: {
        create: {
          email: CLIENT_EMAIL,
          userId: clientUser.id,
          role: "MEMBER",
          side: "CLIENT",
        },
      },
      threatModel: {
        create: {
          notes:
            "Initial threat model covering the five key trust boundaries of the payment MCP deployment.",
          dataflow: demo.dataflow,
        },
      },
    },
    include: { threatModel: true },
  });

  const threatModelId = project.threatModel!.id;
  const vectorIdByKey = new Map<string, string>();

  for (const b of boundaries) {
    const boundary = await prisma.trustBoundary.create({
      data: {
        threatModelId,
        label: b.label,
        type: b.type,
        description: b.description,
      },
    });
    for (const v of b.vectors) {
      const vector = await prisma.threatVector.create({
        data: {
          trustBoundaryId: boundary.id,
          title: v.title,
          description: v.description,
          strideCategory: v.strideCategory,
          mcpCategory: v.mcpCategory,
          likelihood: v.likelihood,
          impact: v.impact,
        },
      });
      vectorIdByKey.set(v.key, vector.id);
    }
  }

  for (const f of findings) {
    const vectorId = vectorIdByKey.get(f.vectorKey);
    if (!vectorId) continue;
    const dueDate =
      f.dueInDays === null
        ? null
        : new Date(Date.now() + f.dueInDays * 24 * 60 * 60 * 1000);
    const reviewIntervalDays = f.reviewIntervalDays ?? null;
    const reviewDueAt = reviewIntervalDays
      ? new Date(Date.now() + reviewIntervalDays * 24 * 60 * 60 * 1000)
      : null;
    const reminderIntervalDays = f.reminderIntervalDays ?? null;
    const reminderNextAt = reminderIntervalDays
      ? new Date(Date.now() + reminderIntervalDays * 24 * 60 * 60 * 1000)
      : null;
    await prisma.finding.create({
      data: {
        threatVectorId: vectorId,
        projectId: project.id,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        severity: f.severity,
        status: f.status,
        owner: f.owner,
        dueDate,
        evidence: f.evidence,
        reviewIntervalDays,
        reviewDueAt,
        reminderIntervalDays,
        reminderNextAt,
      },
    });
  }

  const vectorCount = vectorIdByKey.size;
  console.log(
    `Seeded users ${DEMO_EMAIL} (assessor) and ${CLIENT_EMAIL} (client), password ${DEMO_PASSWORD}. ` +
      `Project "${project.name}" [acceptance: DUAL] with ${boundaries.length} boundaries, ` +
      `${vectorCount} vectors, ${findings.length} findings.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
