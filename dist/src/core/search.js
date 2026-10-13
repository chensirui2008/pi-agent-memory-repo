import { resolveScopePaths } from "../config.js";
import { scanRepo } from "./repo.js";
const CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/**
 * Tokenizes a string into search terms (lowercase, alphanumeric, and CJK n-grams).
 */
export function tokenize(text) {
    const rawTerms = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_/-]/gu, " ")
        .split(/\s+/)
        .map((t) => t.replace(/^[-_/]+|[-_/]+$/g, ""))
        .filter((t) => t.length > 0);
    const result = [];
    for (const term of rawTerms) {
        if (!result.includes(term)) {
            result.push(term);
        }
        // If the term contains CJK characters, extract character 2-grams
        if (CJK_REGEX.test(term) && term.length > 2) {
            for (let i = 0; i < term.length - 1; i++) {
                const bigram = term.slice(i, i + 2);
                if (!result.includes(bigram)) {
                    result.push(bigram);
                }
            }
        }
    }
    return result;
}
/**
 * Scores a single MemoryEntry against a query and its terms.
 */
export function scoreEntry(entry, query, terms) {
    if (terms.length === 0) {
        return { score: 1, matchedTerms: [] };
    }
    const factLower = entry.fact.toLowerCase();
    const rawLower = entry.raw.toLowerCase();
    const queryLower = query.toLowerCase().trim();
    let score = 0;
    const matchedTerms = new Set();
    // 1. Exact full query phrase match
    if (factLower.includes(queryLower)) {
        score += 15;
    }
    // 2. Individual term scoring
    for (const term of terms) {
        let termMatched = false;
        const isCjk = CJK_REGEX.test(term);
        // Check exact word match in fact
        if (isCjk) {
            if (factLower.includes(term)) {
                score += term.length >= 2 ? 5 : 2.5;
                termMatched = true;
            }
        }
        else {
            const wordRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
            if (wordRegex.test(factLower)) {
                score += 5;
                termMatched = true;
            }
            else if (factLower.includes(term)) {
                score += 2.5;
                termMatched = true;
            }
        }
        // Check in metadata values
        for (const [key, val] of Object.entries(entry.metadata)) {
            const valLower = val.toLowerCase();
            if (valLower.includes(term)) {
                score += 3;
                termMatched = true;
            }
        }
        // Check in wiki links
        for (const link of entry.links) {
            if (link.target.toLowerCase().includes(term)) {
                score += 4;
                termMatched = true;
            }
        }
        // Check in file path
        if (entry.file.toLowerCase().includes(term)) {
            score += 3;
            termMatched = true;
        }
        if (termMatched) {
            matchedTerms.add(term);
        }
    }
    // 3. Term coverage bonus
    if (matchedTerms.size > 0) {
        const coverage = matchedTerms.size / terms.length;
        score = score * (0.5 + coverage);
    }
    else if (!factLower.includes(queryLower)) {
        score = 0;
    }
    // 4. Recency boost (only applies if entry matched relevance)
    if (score > 0 && entry.metadata.added) {
        const entryDate = new Date(entry.metadata.added).getTime();
        if (!isNaN(entryDate)) {
            const daysOld = (Date.now() - entryDate) / (1000 * 60 * 60 * 24);
            if (daysOld <= 7) {
                score += 2;
            }
            else if (daysOld <= 30) {
                score += 1;
            }
        }
    }
    return {
        score: Math.round(score * 10) / 10,
        matchedTerms: Array.from(matchedTerms),
    };
}
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Searches and recalls memories across configured scopes.
 */
export async function recallMemories(options) {
    const scope = options.scope || "all";
    const limit = options.limit || 10;
    const mappings = resolveScopePaths(scope, options.workspaceDir);
    const allEntries = [];
    for (const mapping of mappings) {
        const { allEntries: entries } = await scanRepo(mapping.path, mapping.scope);
        allEntries.push(...entries);
    }
    const terms = tokenize(options.query);
    const scoredResults = [];
    for (const entry of allEntries) {
        const { score, matchedTerms } = scoreEntry(entry, options.query, terms);
        if (terms.length === 0 || score > 0) {
            scoredResults.push({
                entry,
                score,
                matchedTerms,
            });
        }
    }
    // Rank by score descending, then by date descending
    scoredResults.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        const dateA = a.entry.metadata.added || "";
        const dateB = b.entry.metadata.added || "";
        return dateB.localeCompare(dateA);
    });
    return scoredResults.slice(0, limit);
}
//# sourceMappingURL=search.js.map