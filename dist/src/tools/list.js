import { resolveScopePaths } from "../config.js";
import { Type } from "../core/schema.js";
import { scanRepo } from "../core/repo.js";
export const memoryListTool = {
    name: "memory_list",
    label: "Memory List",
    description: "Lists all memory files, entry counts, and topic index links in universal and project memory repositories.",
    parameters: Type.Object({
        scope: Type.Optional(Type.Union([Type.Literal("all"), Type.Literal("global"), Type.Literal("project")], {
            description: "Memory scope to inspect: 'all' (default), 'global', or 'project'",
        })),
    }),
    async handler(params, ctx) {
        const scope = params.scope || "all";
        const mappings = resolveScopePaths(scope, ctx.workspaceDir || ctx.cwd || process.cwd());
        const sections = [];
        for (const mapping of mappings) {
            const { files, allEntries, brokenLinks } = await scanRepo(mapping.path, mapping.scope);
            const title = mapping.scope === "global" ? "Universal Memory (~/.pi/agent-memory)" : "Project Memory (.pi/memory)";
            if (files.length === 0) {
                sections.push(`### ${title}\n*Repository is empty or not yet initialized.*`);
                continue;
            }
            const lines = [
                `### ${title}`,
                `Path: \`${mapping.path}\``,
                `Total Files: ${files.length} | Total Entries: ${allEntries.length}`,
                "",
                "| File | Title | Entries | Wiki-Links |",
                "| :--- | :--- | :---: | :---: |",
            ];
            for (const file of files) {
                const linkCount = file.indexLinks.length + file.entries.reduce((sum, e) => sum + e.links.length, 0);
                lines.push(`| \`${file.file}\` | ${file.title} | ${file.entries.length} | ${linkCount} |`);
            }
            if (brokenLinks.length > 0) {
                lines.push("", `⚠️ **Broken Wiki-Links Detected (${brokenLinks.length}):**`);
                for (const bl of brokenLinks) {
                    lines.push(`- \`${bl.fromFile}\` contains unresolvable link: \`${bl.link}\``);
                }
            }
            sections.push(lines.join("\n"));
        }
        return {
            content: [{ type: "text", text: sections.join("\n\n---\n\n") }],
        };
    },
    async execute(...args) {
        const isThreeArgs = args.length >= 3 || (args.length === 2 && typeof args[0] === "string");
        const params = isThreeArgs ? args[1] : args[0];
        const ctx = (args.length >= 5 ? args[4] : isThreeArgs ? args[2] : args[1]) || {};
        return memoryListTool.handler(params || {}, ctx);
    },
};
//# sourceMappingURL=list.js.map