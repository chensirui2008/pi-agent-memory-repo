import { MemoryScope } from "./core/types.js";
/**
 * Returns the resolved global (universal) memory repository path.
 * Defaults to ~/.pi/agent-memory unless AGENT_MEMORY_GLOBAL_DIR is specified.
 */
export declare function getGlobalMemoryDir(): string;
/**
 * Returns the resolved project-level memory repository path.
 * Defaults to <workspace>/.pi/memory unless AGENT_MEMORY_PROJECT_DIR is specified.
 * If <workspace>/.memory exists, honors it for backward compatibility.
 */
export declare function getProjectMemoryDir(workspaceDir?: string): string;
export interface ScopePathMapping {
    scope: MemoryScope;
    path: string;
}
/**
 * Resolves directory paths for given scope selector ("all" | "global" | "project").
 */
export declare function resolveScopePaths(scope?: "all" | "global" | "project", workspaceDir?: string): ScopePathMapping[];
//# sourceMappingURL=config.d.ts.map