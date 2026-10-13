import { getGlobalMemoryDir, getProjectMemoryDir } from "../config.js";
import { Type } from "../core/schema.js";
import { writeEntry } from "../core/repo.js";
export const memoryWriteTool = {
    name: "memory_write",
    label: "Memory Write",
    description: "Writes a single-line memory entry with metadata to a topic file or root MEMORY.md, and automatically commits it to Git.",
    parameters: Type.Object({
        content: Type.String({
            description: "The fact or instruction to store as durable memory",
        }),
        file: Type.Optional(Type.String({
            description: "Target markdown file (e.g. 'topics/user_preferences.md', 'topics/architecture.md', or 'MEMORY.md'). Defaults to 'topics/notes.md'",
        })),
        scope: Type.Optional(Type.Union([Type.Literal("global"), Type.Literal("project")], {
            description: "Target repository scope: 'global' (~/.pi/agent-memory) or 'project' (.pi/memory). Defaults to 'project'",
        })),
        source: Type.Optional(Type.String({
            description: "Citation or source identifier (e.g. 'session_123', 'pr_45', 'user_preference')",
        })),
    }),
    async handler(params, ctx) {
        const scope = params.scope || "project";
        const repoPath = scope === "global"
            ? getGlobalMemoryDir()
            : getProjectMemoryDir(ctx.workspaceDir || ctx.cwd || process.cwd());
        const metadata = {};
        if (params.source) {
            metadata.source = params.source;
        }
        try {
            const { entry, committed, hash } = await writeEntry(repoPath, params.content, {
                file: params.file,
                scope,
                metadata,
            });
            const hashInfo = hash ? ` (commit ${hash})` : "";
            const text = [
                `Successfully saved memory entry to ${scope} repository${hashInfo}:`,
                "",
                `\`${entry.raw}\``,
                "",
                `File: \`${entry.file}\``,
            ].join("\n");
            return {
                content: [{ type: "text", text }],
            };
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `Error writing memory entry: ${err.message}` }],
                isError: true,
            };
        }
    },
    async execute(...args) {
        const isThreeArgs = args.length >= 3 || (args.length === 2 && typeof args[0] === "string");
        const params = isThreeArgs ? args[1] : args[0];
        const ctx = (args.length >= 5 ? args[4] : isThreeArgs ? args[2] : args[1]) || {};
        return memoryWriteTool.handler(params || {}, ctx);
    },
};
//# sourceMappingURL=write.js.map