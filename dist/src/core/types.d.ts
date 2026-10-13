/**
 * Core type definitions for pi-agent-memory-repo
 */
export type MemoryScope = "global" | "project";
export type MemoryMetadata = Record<string, string>;
export interface WikiLink {
    raw: string;
    target: string;
    resolvedPath?: string;
    exists?: boolean;
}
export interface MemoryEntry {
    raw: string;
    fact: string;
    metadata: MemoryMetadata;
    links: WikiLink[];
    file: string;
    absPath: string;
    line: number;
    scope: MemoryScope;
}
export interface MemoryFile {
    file: string;
    absPath: string;
    title: string;
    entries: MemoryEntry[];
    indexLinks: WikiLink[];
    content: string;
}
export interface MemoryRepoStatus {
    scope: MemoryScope;
    path: string;
    exists: boolean;
    isGit: boolean;
    branch?: string;
    clean?: boolean;
    lastCommit?: {
        hash: string;
        message: string;
        date: string;
    };
    commitCount: number;
    fileCount: number;
    entryCount: number;
    brokenLinks: Array<{
        fromFile: string;
        link: string;
    }>;
}
export interface SearchResult {
    entry: MemoryEntry;
    score: number;
    matchedTerms: string[];
}
export interface DreamingReport {
    scope: MemoryScope;
    duplicatesMerged: number;
    patternsSynthesized: number;
    contradictionsResolved: number;
    filesModified: string[];
    synthesizedEntries: string[];
    mergedEntries: string[];
    commitHash?: string;
}
/**
 * Pi Coding Agent Extension API types
 */
export interface ToolCallResultContent {
    type: "text" | "image";
    text?: string;
    data?: string;
    mimeType?: string;
}
export interface ToolCallResult {
    content: ToolCallResultContent[];
    isError?: boolean;
}
export interface ToolContext {
    cwd?: string;
    workspaceDir?: string;
    [key: string]: any;
}
export interface ToolDefinition<TParams = any> {
    name: string;
    label?: string;
    description: string;
    parameters: any;
    handler?: (params: TParams, ctx: ToolContext) => Promise<ToolCallResult>;
    execute?: {
        (toolCallId: string, params: TParams, signal: AbortSignal | undefined, onUpdate: ((result: ToolCallResult) => void) | undefined, ctx: ToolContext): Promise<ToolCallResult>;
        (toolCallId: string, params: TParams, ctx: ToolContext): Promise<ToolCallResult>;
        (params: TParams, ctx: ToolContext): Promise<ToolCallResult>;
        (...args: any[]): Promise<ToolCallResult>;
    };
}
export interface CommandContext {
    ui?: {
        notify?: (message: string, type?: "info" | "warning" | "error" | "success") => void;
        log?: (message: string) => void;
    };
    cwd?: string;
    workspaceDir?: string;
    sessionManager?: {
        getBranch(): Array<{
            type: string;
            message?: any;
        }>;
    };
    session?: any;
    [key: string]: any;
}
export interface CommandOptions {
    description: string;
    handler: (args: string, ctx: CommandContext) => Promise<void>;
}
export interface ExtensionAPI {
    registerTool: (tool: ToolDefinition<any>) => void;
    registerCommand: (nameOrDef: string | ({
        name: string;
    } & CommandOptions), opts?: CommandOptions) => void;
    on?: (event: string, listener: (...args: any[]) => any) => void;
    [key: string]: any;
}
//# sourceMappingURL=types.d.ts.map