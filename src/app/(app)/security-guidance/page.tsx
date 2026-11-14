import { KnowledgePanel } from "@/components/app/knowledge-panel";
import { McpCategoryBadge } from "@/components/shared/badges";
import { KNOWLEDGE_LIST } from "@/lib/mcp-knowledge-base";
import { PageHeader } from "@/components/shared/page-header";

export default function SecurityGuidancePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 [&>*]:max-w-4xl">
      <PageHeader
        title="Security guidance"
        description="Reference library of MCP-specific threat categories with recommended mitigations and source citations. Use these when mapping threat vectors and writing findings."
      />

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
            <KnowledgePanel category={k.category} heading="h2" />
          </section>
        ))}
      </div>
    </div>
  );
}
