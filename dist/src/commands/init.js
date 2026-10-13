import { resolveScopePaths } from "../config.js";
import { initRepo } from "../core/repo.js";
/**
 * Handler for `/init memory [global|project|all]`
 */
export async function handleInitCommand(args, ctx) {
    const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let scopeArg = "all";
    if (parts.length > 0) {
        if (parts[0] === "memory") {
            scopeArg = parts[1] || "all";
        }
        else if (["global", "project", "all"].includes(parts[0])) {
            scopeArg = parts[0];
        }
        else {
            const msg = `❌ Unknown argument "${parts[0]}".\nUsage: \`/init memory [global|project|all]\` or \`/init-memory [global|project|all]\``;
            ctx.ui?.notify?.(msg, "warning");
            ctx.ui?.log?.(msg);
            return;
        }
    }
    const validScope = (["global", "project", "all"].includes(scopeArg) ? scopeArg : "all");
    const mappings = resolveScopePaths(validScope, ctx.workspaceDir || ctx.cwd || process.cwd());
    const messages = [];
    for (const mapping of mappings) {
        try {
            const res = await initRepo(mapping.path, mapping.scope);
            const scopeLabel = mapping.scope === "global" ? "Universal Memory" : "Project Memory";
            if (res.created) {
                messages.push(`✅ Initialized new ${scopeLabel} at \`${res.repoPath}\``);
            }
            else {
                messages.push(`ℹ️ Verified existing ${scopeLabel} at \`${res.repoPath}\``);
            }
        }
        catch (err) {
            messages.push(`❌ Failed to initialize ${mapping.scope} memory: ${err.message}`);
        }
    }
    const output = messages.join("\n");
    if (ctx.ui?.notify) {
        ctx.ui.notify(output, "info");
    }
    if (ctx.ui?.log) {
        ctx.ui.log(output);
    }
}
//# sourceMappingURL=init.js.map