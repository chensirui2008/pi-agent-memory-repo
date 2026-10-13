import { Type } from "../core/schema.js";
import { recallMemories } from "../core/search.js";
import { ToolCallResult, ToolContext, ToolDefinition } from "../core/types.js";

export const memoryRecallTool: ToolDefinition = {
  name: "memory_recall",
  label: "Memory Recall",
  description:
    "Searches and recalls persistent memory entries across global (~/.pi/agent-memory) and project (.pi/memory) repositories using keyword and relevance scoring.",
  parameters: Type.Object({
    query: Type.String({
      description: "Keywords or phrase to recall from persistent memory",
    }),
    scope: Type.Optional(
      Type.Union(
        [Type.Literal("all"), Type.Literal("global"), Type.Literal("project")],
        {
          description: "Search scope: 'all' (default), 'global', or 'project'",
        }
      )
    ),
    limit: Type.Optional(
      Type.Number({
        description: "Maximum number of memory entries to return (default: 10)",
      })
    ),
  }),
  async handler(params: { query: string; scope?: "all" | "global" | "project"; limit?: number }, ctx: ToolContext): Promise<ToolCallResult> {
    const results = await recallMemories({
      query: params.query,
      scope: params.scope || "all",
      limit: params.limit || 10,
      workspaceDir: ctx.workspaceDir || ctx.cwd || process.cwd(),
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No matching memory entries found for query: "${params.query}".`,
          },
        ],
      };
    }

    const lines: string[] = [
      `Found ${results.length} relevant memory entries for "${params.query}":`,
      "",
    ];

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const scopeBadge = res.entry.scope === "global" ? "[Global]" : "[Project]";
      const metaPairs = Object.entries(res.entry.metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      const metaStr = metaPairs ? ` (${metaPairs})` : "";

      lines.push(
        `${i + 1}. ${scopeBadge} **${res.entry.fact}**${metaStr}`
      );
      lines.push(
        `   ↳ File: \`${res.entry.file}:${res.entry.line}\` | Relevance: ${res.score}`
      );
      if (res.entry.links.length > 0) {
        const linksList = res.entry.links.map((l) => l.raw).join(", ");
        lines.push(`   ↳ Wiki-Links: ${linksList}`);
      }
      lines.push("");
    }

    return {
      content: [
        {
          type: "text",
          text: lines.join("\n"),
        },
      ],
    };
  },
  async execute(...args: any[]): Promise<ToolCallResult> {
    const isThreeArgs = args.length >= 3 || (args.length === 2 && typeof args[0] === "string");
    const params = isThreeArgs ? args[1] : args[0];
    const ctx = (args.length >= 5 ? args[4] : isThreeArgs ? args[2] : args[1]) || {};
    return memoryRecallTool.handler!(params || {}, ctx);
  },
};
