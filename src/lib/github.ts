// GitHub repository fetch + heuristic prefilter for the auto threat-modeling
// pipeline. We read a public repo through the GitHub REST API (no clone) and
// distill a small, capped set of candidate files that best describe the app's
// architecture, dataflows, and MCP surface. The output feeds src/lib/analysis.
//
// SSRF discipline: every network call goes to api.github.com ONLY (host-locked,
// mirroring the allowlist stance in src/lib/url-safety.ts). The repo URL is only
// used to extract owner/repo; we never fetch an arbitrary user-supplied host.

const GITHUB_API = "https://api.github.com";

// Caps that keep a synchronous analysis run well under a minute and the prompt
// within budget.
const MAX_FILES = 24;
const MAX_FILE_BYTES = 24_000; // per file, truncated beyond this
const MAX_TOTAL_BYTES = 260_000; // across all fetched files

export interface RepoFile {
  path: string;
  content: string;
  truncated: boolean;
}

export interface RepoBundle {
  owner: string;
  repo: string;
  ref: string; // resolved default branch
  htmlUrl: string;
  description: string | null;
  files: RepoFile[];
  mcpSignals: string[]; // human-readable signals found during prefilter
}

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

/** Parse `owner/repo` from a github.com URL. Host-locked to github.com. */
export function parseRepoUrl(input: string): { owner: string; repo: string } {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new GithubError(400, "Enter a valid https://github.com/owner/repo URL.");
  }
  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    throw new GithubError(400, "Only public github.com repositories are supported.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new GithubError(400, "URL must be https://github.com/owner/repo.");
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new GithubError(400, "Repository owner/name contains invalid characters.");
  }
  return { owner, repo };
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MCPThreat-analyzer",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const t = token?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function ghJson<T>(path: string, token?: string): Promise<T> {
  // path is always a server-constructed api.github.com path — never a raw URL.
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers(token) });
  if (res.status === 404) throw new GithubError(404, "Repository not found or is private.");
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new GithubError(
        429,
        "GitHub API rate limit reached. Add a token or try again later.",
      );
    }
    throw new GithubError(403, "GitHub denied the request (private repo or blocked).");
  }
  if (!res.ok) throw new GithubError(502, `GitHub API error (${res.status}).`);
  return (await res.json()) as T;
}

// --- Heuristic prefilter ----------------------------------------------------
// Score each tree path by how likely it is to describe architecture / dataflow /
// MCP surface, then take the top N. Priorities: docs (README), manifests,
// server entrypoints, container/config, env examples.

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

const HIGH_VALUE = [
  /^readme(\.md|\.rst|\.txt)?$/i,
  /^package\.json$/i,
  /^pyproject\.toml$/i,
  /^requirements\.txt$/i,
  /^pnpm-workspace\.yaml$/i,
  /^go\.mod$/i,
  /^cargo\.toml$/i,
  /^mcp\.json$/i,
  /^dockerfile$/i,
  /^docker-compose\.ya?ml$/i,
  /^\.env\.example$/i,
  /^smithery\.ya?ml$/i,
];

const NAME_SIGNALS = [
  /(^|\/)(server|main|index|app|__main__)\.(ts|js|mjs|py|go|rs)$/i,
  /(^|\/)src\/.*\.(ts|js|py|go|rs)$/i,
  /(^|\/)(tools?|handlers?|routes?|api)\/.*\.(ts|js|py|go|rs)$/i,
  /(^|\/)docs?\/.*\.(md|mdx)$/i,
];

const SKIP_DIR = /(^|\/)(node_modules|dist|build|\.git|vendor|test|tests|__pycache__|\.next|coverage|examples?)\//i;

function scorePath(entry: TreeEntry): number {
  const p = entry.path;
  if (entry.type !== "blob") return -1;
  if (SKIP_DIR.test(`/${p}/`)) return -1;
  if ((entry.size ?? 0) > 400_000) return -1; // skip huge blobs

  const base = p.split("/").pop() ?? p;
  let score = 0;
  if (HIGH_VALUE.some((re) => re.test(base))) score += 100;
  if (NAME_SIGNALS.some((re) => re.test(p))) score += 40;
  // Shallow files are usually more descriptive of the whole app.
  score -= p.split("/").length * 2;
  // Prefer text-ish source/docs/config.
  if (!/\.(md|mdx|json|toml|ya?ml|txt|ts|tsx|js|mjs|py|go|rs|env|example)$/i.test(base)) {
    score -= 30;
  }
  return score;
}

// MCP-specific content signals we surface to the analyzer.
const CONTENT_SIGNALS: { re: RegExp; label: string }[] = [
  { re: /@modelcontextprotocol\/sdk/i, label: "Uses @modelcontextprotocol/sdk (TypeScript MCP SDK)" },
  { re: /\bfrom\s+mcp\b|\bimport\s+mcp\b|\bfastmcp\b/i, label: "Uses a Python MCP SDK (mcp / FastMCP)" },
  { re: /new\s+Server\s*\(|McpServer\s*\(/i, label: "Instantiates an MCP Server" },
  { re: /registerTool|setRequestHandler|list_tools|call_tool|add_tool/i, label: "Registers MCP tools/handlers" },
  { re: /StdioServerTransport|SSEServerTransport|StreamableHTTP/i, label: "Declares an MCP transport" },
  { re: /list_resources|read_resource|resources\/list/i, label: "Exposes MCP resources" },
];

/**
 * Fetch a repo and return a distilled bundle for analysis.
 * @param token optional GitHub token — used per-request, never persisted.
 */
export async function fetchRepoBundle(repoUrl: string, token?: string): Promise<RepoBundle> {
  const { owner, repo } = parseRepoUrl(repoUrl);

  const meta = await ghJson<{
    default_branch: string;
    html_url: string;
    description: string | null;
    private: boolean;
  }>(`/repos/${owner}/${repo}`, token);

  if (meta.private) throw new GithubError(403, "Repository is private.");
  const ref = meta.default_branch || "main";

  const tree = await ghJson<{ tree: TreeEntry[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    token,
  );

  const ranked = tree.tree
    .map((e) => ({ e, s: scorePath(e) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_FILES)
    .map((x) => x.e);

  const files: RepoFile[] = [];
  const signalSet = new Set<string>();
  let totalBytes = 0;

  for (const entry of ranked) {
    if (totalBytes >= MAX_TOTAL_BYTES) break;
    let raw: string;
    try {
      raw = await fetchRawFile(owner, repo, ref, entry.path, token);
    } catch {
      continue; // skip files that fail to fetch; keep the run going
    }
    const truncated = raw.length > MAX_FILE_BYTES;
    const content = truncated ? raw.slice(0, MAX_FILE_BYTES) : raw;
    totalBytes += content.length;
    files.push({ path: entry.path, content, truncated });
    for (const sig of CONTENT_SIGNALS) {
      if (sig.re.test(content)) signalSet.add(sig.label);
    }
  }

  return {
    owner,
    repo,
    ref,
    htmlUrl: meta.html_url,
    description: meta.description,
    files,
    mcpSignals: [...signalSet],
  };
}

/** Fetch a single file's decoded contents via the contents API (base64). */
async function fetchRawFile(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  token?: string,
): Promise<string> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const data = await ghJson<{ content?: string; encoding?: string }>(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    token,
  );
  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  if (typeof data.content === "string") return data.content;
  throw new GithubError(502, "Unexpected file content response.");
}
