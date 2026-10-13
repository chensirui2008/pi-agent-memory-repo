import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initRepo, readMemoryFile, writeEntry } from "../src/core/repo.js";
import { checkContradiction, extractKeywords, jaccardSimilarity, runDreaming, } from "../src/core/dreaming.js";
describe("Dreaming & Pattern Synthesis Tests", () => {
    it("calculates string Jaccard similarity accurately", () => {
        const s1 = "Autocomplete is called ghost_text in code and events";
        const s2 = "Autocomplete is referred to as ghost_text in codebase and events";
        const s3 = "Always use PostgreSQL for production database";
        assert.ok(jaccardSimilarity(s1, s2) > 0.45);
        assert.equal(jaccardSimilarity(s1, s3), 0);
    });
    it("extracts meaningful keyword stems filtering stopwords", () => {
        const kws = extractKeywords("Always run tests with HOME=/tmp in sandboxed environments");
        assert.ok(kws.includes("tests"));
        assert.ok(kws.includes("sandboxed"));
        assert.ok(kws.includes("environments"));
        assert.ok(!kws.includes("the"));
        assert.ok(!kws.includes("with"));
    });
    it("detects contradictions between conflicting instructions", () => {
        const e1 = {
            raw: "- Always use tabs for indentation [added: 2026-10-10]",
            fact: "Always use tabs for indentation",
            metadata: { added: "2026-10-10" },
            links: [],
            file: "topics/notes.md",
            absPath: "",
            line: 1,
            scope: "project",
        };
        const e2 = {
            raw: "- Never use tabs for indentation, use spaces [added: 2026-10-13]",
            fact: "Never use tabs for indentation, use spaces",
            metadata: { added: "2026-10-13" },
            links: [],
            file: "topics/notes.md",
            absPath: "",
            line: 2,
            scope: "project",
        };
        assert.equal(checkContradiction(e1, e2), true);
    });
    it("merges duplicates, synthesizes patterns, and commits clean updates to git", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dreaming-test-"));
        await initRepo(tmpDir, "project");
        // 1. Add near duplicate entries
        await writeEntry(tmpDir, "Always run tests with HOME=/tmp to avoid permission errors", {
            file: "topics/notes.md",
            metadata: { source: "session_1", added: "2026-10-10" },
        });
        await writeEntry(tmpDir, "Always run tests with HOME=/tmp to prevent permission errors", {
            file: "topics/notes.md",
            metadata: { source: "session_2", added: "2026-10-12" },
        });
        // 2. Add multiple observations sharing a keyword for pattern clustering
        await writeEntry(tmpDir, "Sandbox test isolation requires HOME=/tmp configuration", {
            file: "topics/sandbox.md",
            metadata: { source: "session_3", added: "2026-10-13" },
        });
        const report = await runDreaming(tmpDir, "project");
        assert.ok(report.duplicatesMerged >= 1);
        assert.ok(report.patternsSynthesized >= 1);
        assert.ok(report.filesModified.length > 0);
        assert.ok(report.commitHash);
        // Verify patterns file was created and indexed in MEMORY.md
        const patternsContent = await readMemoryFile(tmpDir, "topics/patterns.md");
        assert.ok(patternsContent?.includes("Recurring Pattern"));
        const memoryMd = await readMemoryFile(tmpDir, "MEMORY.md");
        assert.ok(memoryMd?.includes("[[topics/patterns]]"));
        // Verify duplicate merged into single note preserving combined source
        const notesContent = await readMemoryFile(tmpDir, "topics/notes.md");
        assert.ok(notesContent?.includes("source: session_1, session_2"));
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("accurately scores Chinese string similarity and extracts keywords", () => {
        const s1 = "总是使用vitest进行单元测试";
        const s2 = "总是使用vitest进行测试";
        const s3 = "完全不相关的数据库说明";
        const sim12 = jaccardSimilarity(s1, s2);
        const sim13 = jaccardSimilarity(s1, s3);
        assert.ok(sim12 > 0.7, `Expected high similarity, got ${sim12}`);
        assert.ok(sim13 < 0.2, `Expected low similarity, got ${sim13}`);
        const kws = extractKeywords("前端架构约定使用React和TypeScript");
        assert.ok(kws.includes("react"));
        assert.ok(kws.includes("typescript"));
    });
    it("does not falsely flag comparative statements as contradictions", () => {
        const e1 = {
            raw: "- Never use tabs, always use spaces [added: 2026-10-10]",
            fact: "Never use tabs, always use spaces",
            metadata: { added: "2026-10-10" },
            links: [],
            file: "topics/notes.md",
            absPath: "",
            line: 1,
            scope: "project",
        };
        const e2 = {
            raw: "- Prefer using spaces over tabs [added: 2026-10-13]",
            fact: "Prefer using spaces over tabs",
            metadata: { added: "2026-10-13" },
            links: [],
            file: "topics/notes.md",
            absPath: "",
            line: 2,
            scope: "project",
        };
        assert.equal(checkContradiction(e1, e2), false);
    });
    it("preserves non-bullet markdown paragraphs and documentation during dreaming", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dreaming-preserve-"));
        await initRepo(tmpDir, "project");
        const topicPath = path.join(tmpDir, "topics", "notes.md");
        fs.writeFileSync(topicPath, "# General Notes\n\nImportant guide: Read before modifying codebase.\n\n- Note A [added: 2026-10-10]\n- Note A [added: 2026-10-11]\n", "utf8");
        await runDreaming(tmpDir, "project");
        const updated = await readMemoryFile(tmpDir, "topics/notes.md");
        assert.ok(updated?.includes("Important guide: Read before modifying codebase."));
        assert.ok(updated?.includes("- Note A"));
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=dreaming.test.js.map