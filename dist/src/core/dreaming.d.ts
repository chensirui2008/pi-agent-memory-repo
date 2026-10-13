import { DreamingReport, MemoryEntry, MemoryScope } from "./types.js";
/**
 * Calculates Jaccard and overlap similarity between two strings.
 * Supports multilingual, CJK, and technical abbreviations.
 */
export declare function stringSimilarity(str1: string, str2: string): number;
export declare function jaccardSimilarity(str1: string, str2: string): number;
/**
 * Extracts meaningful keyword stems from an entry for pattern detection.
 */
export declare function extractKeywords(text: string): string[];
/**
 * Checks if two entries contradict each other on a shared topic.
 */
export declare function checkContradiction(e1: MemoryEntry, e2: MemoryEntry): boolean;
/**
 * Runs the Dreaming consolidation engine on a memory repository.
 */
export declare function runDreaming(repoPath: string, scope: MemoryScope): Promise<DreamingReport>;
//# sourceMappingURL=dreaming.d.ts.map