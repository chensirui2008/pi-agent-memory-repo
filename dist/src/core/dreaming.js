import * as fs from "node:fs";
import * as path from "node:path";
import { formatEntry, parseMemoryFile } from "./parser.js";
import { getTodayDate, scanRepo, updateIndex, resolveMemoryPath } from "./repo.js";
import { gitCommit } from "./git.js";
const CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
function extractSimilarityTokens(str) {
    const set = new Set();
    const words = str
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(Boolean);
    for (const w of words) {
        if (CJK_REGEX.test(w)) {
            // For CJK text: extract unigrams and bigrams
            for (let i = 0; i < w.length; i++) {
                set.add(w[i]);
                if (i + 1 < w.length) {
                    set.add(w.slice(i, i + 2));
                }
            }
        }
        else if (w.length >= 2) {
            set.add(w);
        }
    }
    return set;
}
/**
 * Calculates Jaccard and overlap similarity between two strings.
 * Supports multilingual, CJK, and technical abbreviations.
 */
export function stringSimilarity(str1, str2) {
    const set1 = extractSimilarityTokens(str1);
    const set2 = extractSimilarityTokens(str2);
    if (set1.size === 0 && set2.size === 0)
        return 1.0;
    if (set1.size === 0 || set2.size === 0)
        return 0.0;
    let intersection = 0;
    for (const item of set1) {
        if (set2.has(item)) {
            intersection++;
        }
    }
    const union = set1.size + set2.size - intersection;
    const jaccard = union === 0 ? 0 : intersection / union;
    const minSize = Math.min(set1.size, set2.size);
    const overlap = minSize === 0 ? 0 : intersection / minSize;
    return Math.max(jaccard, overlap * 0.9);
}
export function jaccardSimilarity(str1, str2) {
    return stringSimilarity(str1, str2);
}
/**
 * Common stopwords to exclude during pattern clustering.
 */
const STOPWORDS = new Set([
    "the", "and", "that", "have", "for", "not", "with", "you", "this", "but",
    "his", "from", "they", "say", "her", "she", "will", "one", "all", "would",
    "there", "their", "what", "out", "about", "who", "get", "which", "go",
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
    "people", "into", "year", "your", "good", "some", "could", "them", "see",
    "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
    "also", "back", "after", "use", "two", "how", "our", "work", "first", "well",
    "way", "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
    "进行", "一个", "对于", "关于", "总是", "使用"
]);
/**
 * Extracts meaningful keyword stems from an entry for pattern detection.
 */
export function extractKeywords(text) {
    const separated = text.replace(/([a-zA-Z0-9_-]+)/gu, " $1 ");
    const words = separated
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
        .split(/\s+/)
        .filter(Boolean);
    const result = [];
    for (const word of words) {
        if (CJK_REGEX.test(word)) {
            if (word.length >= 2 && word.length <= 4) {
                if (!STOPWORDS.has(word) && !result.includes(word)) {
                    result.push(word);
                }
            }
            else if (word.length > 4) {
                for (let i = 0; i < word.length - 1; i++) {
                    const bg = word.slice(i, i + 2);
                    if (!STOPWORDS.has(bg) && !result.includes(bg)) {
                        result.push(bg);
                    }
                }
            }
        }
        else if (word.length >= 2 && !STOPWORDS.has(word)) {
            if (!result.includes(word)) {
                result.push(word);
            }
        }
    }
    return result;
}
const NEGATIVE_MARKERS = [
    "never", "do not", "don't", "avoid", "disable", "cannot", "no ", "deprecated",
    "不要", "禁止", "避免", "over", "instead of", "rather than",
];
const AFFIRMATIVE_MARKERS = [
    "always", "must", "prefer", "enable", "require", "should", "总是", "必须", "推荐",
];
function getWordPolarity(text, word) {
    const t = text.toLowerCase();
    const idx = t.indexOf(word.toLowerCase());
    if (idx === -1)
        return "neutral";
    const beforeClause = t.slice(0, idx).split(/[,;.]/).pop() || "";
    const tokens = beforeClause.trim().split(/\s+/).slice(-5).join(" ");
    const hasNeg = NEGATIVE_MARKERS.some((n) => tokens.includes(n));
    if (hasNeg)
        return "neg";
    const hasAff = AFFIRMATIVE_MARKERS.some((a) => tokens.includes(a)) || tokens.includes("use");
    if (hasAff)
        return "aff";
    return "neutral";
}
/**
 * Checks if two entries contradict each other on a shared topic.
 */
export function checkContradiction(e1, e2) {
    const kw1 = new Set(extractKeywords(e1.fact));
    const kw2 = new Set(extractKeywords(e2.fact));
    // Check overlap of topic keywords
    const sharedKeywords = [];
    for (const k of kw1) {
        if (kw2.has(k))
            sharedKeywords.push(k);
    }
    if (sharedKeywords.length < 1)
        return false;
    const t1 = e1.fact;
    const t2 = e2.fact;
    // Check if there is any shared keyword on which e1 and e2 have opposite polarities
    for (const k of sharedKeywords) {
        const p1 = getWordPolarity(t1, k);
        const p2 = getWordPolarity(t2, k);
        if ((p1 === "aff" && p2 === "neg") || (p1 === "neg" && p2 === "aff")) {
            return true;
        }
    }
    return false;
}
/**
 * Runs the Dreaming consolidation engine on a memory repository.
 */
export async function runDreaming(repoPath, scope) {
    const resolvedPath = path.resolve(repoPath);
    const today = getTodayDate();
    const report = {
        scope,
        duplicatesMerged: 0,
        patternsSynthesized: 0,
        contradictionsResolved: 0,
        filesModified: [],
        synthesizedEntries: [],
        mergedEntries: [],
    };
    const { files, allEntries } = await scanRepo(resolvedPath, scope);
    if (allEntries.length === 0) {
        return report;
    }
    const modifiedFiles = new Set();
    // 1. Group and detect duplicates across entries
    const entriesByFile = new Map();
    for (const file of files) {
        entriesByFile.set(file.file, [...file.entries]);
    }
    // Detect and merge duplicates within each file
    for (const [relFile, entries] of entriesByFile.entries()) {
        const toRemove = new Set();
        for (let i = 0; i < entries.length; i++) {
            if (toRemove.has(i))
                continue;
            const base = entries[i];
            for (let j = i + 1; j < entries.length; j++) {
                if (toRemove.has(j))
                    continue;
                const candidate = entries[j];
                // Synthesized patterns have distinct keyword identities even when their
                // supporting facts overlap; keep them out of ordinary fact merging.
                if (base.metadata.type === "pattern" || candidate.metadata.type === "pattern")
                    continue;
                const similarity = stringSimilarity(base.fact, candidate.fact);
                if (similarity >= 0.78 && !checkContradiction(base, candidate)) {
                    // Merge candidate into base
                    const combinedSources = new Set();
                    if (base.metadata.source) {
                        base.metadata.source.split(",").forEach((s) => combinedSources.add(s.trim()));
                    }
                    if (candidate.metadata.source) {
                        candidate.metadata.source.split(",").forEach((s) => combinedSources.add(s.trim()));
                    }
                    if (combinedSources.size > 0) {
                        base.metadata.source = Array.from(combinedSources).join(", ");
                    }
                    base.metadata.updated = today;
                    toRemove.add(j);
                    report.duplicatesMerged++;
                    report.mergedEntries.push(`Merged "${candidate.fact}" into "${base.fact}" in ${relFile}`);
                    modifiedFiles.add(relFile);
                }
            }
        }
        if (toRemove.size > 0) {
            const remaining = entries.filter((_, idx) => !toRemove.has(idx));
            entriesByFile.set(relFile, remaining);
        }
    }
    // 2. Contradiction Resolution
    for (const [relFile, entries] of entriesByFile.entries()) {
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const e1 = entries[i];
                const e2 = entries[j];
                if (checkContradiction(e1, e2)) {
                    const date1 = e1.metadata.added || "1970-01-01";
                    const date2 = e2.metadata.added || "1970-01-01";
                    const older = date1 <= date2 ? e1 : e2;
                    const newer = date1 <= date2 ? e2 : e1;
                    if (!older.metadata.status || older.metadata.status !== "superseded") {
                        older.metadata.status = "superseded";
                        older.metadata.superseded_by = newer.fact.slice(0, 40);
                        older.metadata.updated = today;
                        report.contradictionsResolved++;
                        modifiedFiles.add(relFile);
                    }
                }
            }
        }
    }
    // 3. Pattern Detection & Synthesis
    // Cluster entries by keyword across the repository
    const keywordClusters = new Map();
    for (const entry of Array.from(entriesByFile.values()).flat()) {
        if (entry.metadata.type === "pattern" || entry.metadata.status === "superseded") {
            continue; // Skip already synthesized patterns
        }
        const keywords = extractKeywords(entry.fact);
        for (const kw of keywords) {
            if (!keywordClusters.has(kw)) {
                keywordClusters.set(kw, []);
            }
            keywordClusters.get(kw).push(entry);
        }
    }
    const existingPatternsFile = resolveMemoryPath(resolvedPath, "topics/patterns.md");
    const existingPatternsContent = fs.existsSync(existingPatternsFile)
        ? fs.readFileSync(existingPatternsFile, "utf8")
        : "";
    const existingPatterns = new Set(parseMemoryFile(existingPatternsContent, "topics/patterns.md", resolvedPath, scope)
        .entries.map((entry) => entry.metadata.pattern?.toLowerCase()).filter(Boolean));
    const newSynthesizedEntries = [];
    for (const [kw, cluster] of keywordClusters.entries()) {
        // Unique facts in cluster
        const uniqueCluster = Array.from(new Set(cluster.map((c) => c.fact)));
        if (uniqueCluster.length >= 2) {
            // Check if already captured in patterns
            if (existingPatterns.has(kw)) {
                continue;
            }
            // Synthesize rule
            const sources = Array.from(new Set(cluster
                .map((c) => c.metadata.source || c.file)
                .filter(Boolean)));
            const synthesizedFact = `Recurring Pattern (${kw}): Consolidated knowledge observed across sessions (${uniqueCluster.slice(0, 2).join("; ")})`;
            const synthesizedMetadata = {
                added: today,
                type: "pattern",
                pattern: kw,
                source: `synthesized from ${sources.slice(0, 3).join(", ")}`,
            };
            const line = formatEntry(synthesizedFact, synthesizedMetadata);
            newSynthesizedEntries.push(line);
            existingPatterns.add(kw);
            report.patternsSynthesized++;
            report.synthesizedEntries.push(line);
        }
    }
    // 4. Write back modified files preserving non-bullet markdown content
    for (const relFile of modifiedFiles) {
        const updatedEntries = entriesByFile.get(relFile);
        if (!updatedEntries)
            continue;
        const fullPath = resolveMemoryPath(resolvedPath, relFile);
        const existingContent = fs.readFileSync(fullPath, "utf8");
        const parsed = parseMemoryFile(existingContent, relFile, resolvedPath, scope);
        // Entries retain their original line numbers throughout consolidation.
        const updatedByLine = new Map(updatedEntries.map((entry) => [entry.line, entry]));
        const origLines = existingContent.split(/\r?\n/);
        const newLines = [];
        let entryIdx = 0;
        for (let i = 0; i < origLines.length; i++) {
            const line = origLines[i];
            if (entryIdx < parsed.entries.length && parsed.entries[entryIdx].line === i + 1) {
                const updated = updatedByLine.get(i + 1);
                entryIdx++;
                if (updated) {
                    newLines.push(formatEntry(updated.fact, updated.metadata));
                }
                // if null, entry was merged/removed, omit this line
            }
            else {
                newLines.push(line);
            }
        }
        fs.writeFileSync(fullPath, newLines.join("\n"), "utf8");
    }
    // 5. Append new synthesized patterns to topics/patterns.md
    if (newSynthesizedEntries.length > 0) {
        const patternsDir = path.dirname(existingPatternsFile);
        if (!fs.existsSync(patternsDir)) {
            fs.mkdirSync(patternsDir, { recursive: true });
        }
        if (!fs.existsSync(existingPatternsFile)) {
            const header = `# Synthesized Patterns & Rules\n\n`;
            fs.writeFileSync(existingPatternsFile, header + newSynthesizedEntries.join("\n") + "\n", "utf8");
        }
        else {
            let content = fs.readFileSync(existingPatternsFile, "utf8");
            if (!content.endsWith("\n"))
                content += "\n";
            content += newSynthesizedEntries.join("\n") + "\n";
            fs.writeFileSync(existingPatternsFile, content, "utf8");
        }
        await updateIndex(resolvedPath, "topics/patterns.md");
        modifiedFiles.add("topics/patterns.md");
        modifiedFiles.add("MEMORY.md");
    }
    report.filesModified = Array.from(modifiedFiles);
    // 6. Git commit if any changes were made
    if (report.filesModified.length > 0) {
        const commitMsg = `dreaming: synthesize cross-session patterns (${report.patternsSynthesized} patterns, ${report.duplicatesMerged} duplicates merged)`;
        const commitRes = await gitCommit(resolvedPath, commitMsg);
        report.commitHash = commitRes.hash;
    }
    return report;
}
//# sourceMappingURL=dreaming.js.map