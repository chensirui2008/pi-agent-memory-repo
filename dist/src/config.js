import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
/**
 * Returns the resolved global (universal) memory repository path.
 * Defaults to ~/.pi/agent-memory unless AGENT_MEMORY_GLOBAL_DIR is specified.
 */
export function getGlobalMemoryDir() {
    if (process.env.AGENT_MEMORY_GLOBAL_DIR) {
        return path.resolve(process.env.AGENT_MEMORY_GLOBAL_DIR);
    }
    try {
        const home = os.homedir();
        return path.join(home, ".pi", "agent-memory");
    }
    catch {
        return path.join("/tmp", ".pi", "agent-memory");
    }
}
/**
 * Returns the resolved project-level memory repository path.
 * Defaults to <workspace>/.pi/memory unless AGENT_MEMORY_PROJECT_DIR is specified.
 * If <workspace>/.memory exists, honors it for backward compatibility.
 */
export function getProjectMemoryDir(workspaceDir) {
    if (process.env.AGENT_MEMORY_PROJECT_DIR) {
        return path.resolve(process.env.AGENT_MEMORY_PROJECT_DIR);
    }
    const root = workspaceDir ? path.resolve(workspaceDir) : process.cwd();
    const legacyMemoryDir = path.join(root, ".memory");
    if (fs.existsSync(legacyMemoryDir) && fs.statSync(legacyMemoryDir).isDirectory()) {
        return legacyMemoryDir;
    }
    return path.join(root, ".pi", "memory");
}
/**
 * Resolves directory paths for given scope selector ("all" | "global" | "project").
 */
export function resolveScopePaths(scope = "all", workspaceDir) {
    const mappings = [];
    if (scope === "all" || scope === "global") {
        mappings.push({
            scope: "global",
            path: getGlobalMemoryDir(),
        });
    }
    if (scope === "all" || scope === "project") {
        mappings.push({
            scope: "project",
            path: getProjectMemoryDir(workspaceDir),
        });
    }
    return mappings;
}
//# sourceMappingURL=config.js.map