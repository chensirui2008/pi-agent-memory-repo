import { MemoryEntry, MemoryFile, MemoryMetadata, MemoryRepoStatus, MemoryScope } from "./types.js";
/** Resolve a repo-relative path, rejecting traversal and symlink escapes. */
export declare function resolveMemoryPath(repoPath: string, relativePath: string): string;
/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
export declare function getTodayDate(): string;
/**
 * Initializes a Cognition-compliant memory repository with git.
 */
export declare function initRepo(repoPath: string, scope: MemoryScope, customTitle?: string): Promise<{
    created: boolean;
    repoPath: string;
}>;
/**
 * Recursively lists all markdown and documentation files in the memory repository.
 */
export declare function listMemoryFiles(repoPath: string): Promise<string[]>;
/**
 * Reads the content of a memory file.
 */
export declare function readMemoryFile(repoPath: string, relativePath: string): Promise<string | null>;
/**
 * Scans all memory files, parses entries, and detects broken links.
 */
export declare function scanRepo(repoPath: string, scope: MemoryScope): Promise<{
    files: MemoryFile[];
    allEntries: MemoryEntry[];
    brokenLinks: Array<{
        fromFile: string;
        link: string;
    }>;
}>;
/**
 * Ensures a topic link exists in MEMORY.md ## Index section.
 */
export declare function updateIndex(repoPath: string, topicFile: string): Promise<boolean>;
export interface WriteEntryOptions {
    file?: string;
    metadata?: MemoryMetadata;
    scope?: MemoryScope;
    commitMessage?: string;
}
/**
 * Appends a new Cognition bullet entry, updates topic files and index, and commits to git.
 */
export declare function writeEntry(repoPath: string, factText: string, options?: WriteEntryOptions): Promise<{
    entry: MemoryEntry;
    committed: boolean;
    hash?: string;
}>;
/**
 * Retrieves the comprehensive status of a memory repository.
 */
export declare function getStatus(repoPath: string, scope: MemoryScope): Promise<MemoryRepoStatus>;
//# sourceMappingURL=repo.d.ts.map