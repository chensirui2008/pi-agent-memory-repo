import { MemoryEntry, MemoryFile, MemoryMetadata, MemoryScope } from "./types.js";
/**
 * Extracts all [[wiki-link]] targets from a text string.
 */
export declare function extractWikiLinks(text: string): string[];
/**
 * Resolves a wiki-link target relative to a repository root.
 * Cognition spec:
 * - Markdown files omit the .md extension (e.g., [[topics/architecture]] -> topics/architecture.md)
 * - Non-markdown files preserve their extensions (e.g., [[scripts/bench.sh]])
 * - Supports anchors ([[topics/notes#section]]) and aliases ([[topics/notes|Label]])
 */
export declare function resolveWikiLink(target: string, repoRoot: string, sourceFile?: string): {
    resolvedPath: string;
    exists: boolean;
};
/**
 * Parses key-value pairs from a metadata string like "source: session_1; added: 2026-10-13".
 */
export declare function parseMetadataBlock(block: string): MemoryMetadata;
/**
 * Formats a metadata dictionary into a trailing block string:
 * e.g., " [source: session_1; added: 2026-10-13]"
 */
export declare function formatMetadataBlock(metadata?: MemoryMetadata): string;
/**
 * Formats a single-line Cognition bullet entry.
 * Strips duplicate leading bullet markers and sanitizes internal newlines.
 */
export declare function formatEntry(fact: string, metadata?: MemoryMetadata): string;
/**
 * Parses a single line into a MemoryEntry if it matches the bullet format.
 */
export declare function parseEntry(line: string, file: string, lineNum: number, scope: MemoryScope, repoRoot: string): MemoryEntry | null;
/**
 * Parses a markdown memory file content into a MemoryFile structure.
 */
export declare function parseMemoryFile(content: string, relativePath: string, repoRoot: string, scope: MemoryScope): MemoryFile;
//# sourceMappingURL=parser.d.ts.map