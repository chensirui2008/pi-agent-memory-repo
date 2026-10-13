import { getGlobalMemoryDir, getProjectMemoryDir } from "../config.js";
import { Type } from "../core/schema.js";
import { readMemoryFile } from "../core/repo.js";
import { parseMemoryFile } from "../core/parser.js";
export const memoryReadTool = {
    name: "memory_read",
    label: "Memory Read",
    description: "Reads a memory file (e.g. MEMORY.md or topics/architecture.md) and displays its content and resolved wiki-links.",
    parameters: Type.Object({
        path: Type.String({
            description: "Path to the memory file or wiki-link target (e.g. 'MEMORY.md', 'topics/notes', or '[[topics/user_preferences]]')",
        }),
        scope: Type.Optional(Type.Union([Type.Literal("global"), Type.Literal("project")], {
            description: "Target repository scope: 'global' or 'project' (default: 'project')",
        })),
    }),
    async handler(params, ctx) {
        const scope = params.scope || "project";
        const repoPath = scope === "global"
            ? getGlobalMemoryDir()
            : getProjectMemoryDir(ctx.workspaceDir || ctx.cwd || process.cwd());
        let cleanPath = params.path.trim();
        if (cleanPath.startsWith("[[") && cleanPath.endsWith("]]")) {
            cleanPath = cleanPath.slice(2, -2).trim();
        }
        // Strip pipe alias if present
        const pipeIdx = cleanPath.indexOf("|");
        if (pipeIdx !== -1) {
            cleanPath = cleanPath.slice(0, pipeIdx).trim();
        }
        // Strip section anchor if present
        const hashIdx = cleanPath.indexOf("#");
        if (hashIdx !== -1) {
            cleanPath = cleanPath.slice(0, hashIdx).trim();
        }
        const content = await readMemoryFile(repoPath, cleanPath);
        if (content === null) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Memory file not found: "${params.path}" in ${scope} repository (${repoPath}).`,
                    },
                ],
                isError: true,
            };
        }
        const parsed = parseMemoryFile(content, cleanPath, repoPath, scope);
        const lines = [
            `### Memory File: \`${parsed.file}\` (${scope})`,
            "",
            content,
            "",
        ];
        if (parsed.entries.length > 0) {
            lines.push(`*Parsed ${parsed.entries.length} structured memory bullet entries.*`);
        }
        if (parsed.indexLinks.length > 0) {
            const links = parsed.indexLinks
                .map((l) => `${l.raw} (${l.exists ? "valid" : "broken"})`)
                .join(", ");
            lines.push(`*Indexed Topic Links:* ${links}`);
        }
        return {
            content: [{ type: "text", text: lines.join("\n") }],
        };
    },
    async execute(...args) {
        const isThreeArgs = args.length >= 3 || (args.length === 2 && typeof args[0] === "string");
        const params = isThreeArgs ? args[1] : args[0];
        const ctx = (args.length >= 5 ? args[4] : isThreeArgs ? args[2] : args[1]) || {};
        return memoryReadTool.handler(params || {}, ctx);
    },
};
//# sourceMappingURL=read.js.map