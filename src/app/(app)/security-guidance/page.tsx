import { BookOpen } from "lucide-react";
import { KnowledgePanel } from "@/components/app/knowledge-panel";
import { McpCategoryBadge } from "@/components/shared/badges";
import { KNOWLEDGE_LIST } from "@/lib/mcp-knowledge-base";

export default function SecurityGuidancePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-md bg-primary/15 p-2 text-primary">
          <BookOpen className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCP Security Guidance</h1>
          <p className="text-sm text-muted-foreground">
            Reference library of MCP-specific threat categories with recommended mitigations and
            source citations. Use these when mapping threat vectors and writing findings.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {KNOWLEDGE_LIST.map((k) => (
          <a key={k.category} href={`#${k.category}`}>
            <McpCategoryBadge category={k.category} />
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        {KNOWLEDGE_LIST.map((k) => (
          <section key={k.category} id={k.category} className="scroll-mt-6">
            <KnowledgePanel category={k.category} />
          </section>
        ))}
      </div>
    </div>
  );
}
