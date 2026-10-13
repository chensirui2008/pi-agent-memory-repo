import { MemoryEntry, SearchResult } from "./types.js";
export interface SearchOptions {
    query: string;
    scope?: "all" | "global" | "project";
    workspaceDir?: string;
    limit?: number;
}
/**
 * Tokenizes a string into search terms (lowercase, alphanumeric, and CJK n-grams).
 */
export declare function tokenize(text: string): string[];
/**
 * Scores a single MemoryEntry against a query and its terms.
 */
export declare function scoreEntry(entry: MemoryEntry, query: string, terms: string[]): {
    score: number;
    matchedTerms: string[];
};
/**
 * Searches and recalls memories across configured scopes.
 */
export declare function recallMemories(options: SearchOptions): Promise<SearchResult[]>;
//# sourceMappingURL=search.d.ts.map