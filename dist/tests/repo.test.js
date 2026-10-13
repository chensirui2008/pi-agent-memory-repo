import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getStatus, initRepo, readMemoryFile, scanRepo, updateIndex, writeEntry, } from "../src/core/repo.js";
import { isGitRepo } from "../src/core/git.js";
describe("Repository & Git Storage Tests", () => {
    it("initializes memory repository with MEMORY.md, topics, and initial git commit", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-init-test-"));
        const initRes = await initRepo(tmpDir, "project", "Project Alpha");
        assert.equal(initRes.created, false); // Directory was pre-created by mkdtemp
        assert.equal(isGitRepo(tmpDir), true);
        const memoryMd = path.join(tmpDir, "MEMORY.md");
        assert.equal(fs.existsSync(memoryMd), true);
        const memContent = fs.readFileSync(memoryMd, "utf8");
        assert.ok(memContent.includes("# Agent Memory: Project Alpha"));
        assert.ok(memContent.includes("## Index"));
        assert.ok(memContent.includes("- [[topics/notes]]"));
        const notesMd = path.join(tmpDir, "topics", "notes.md");
        assert.equal(fs.existsSync(notesMd), true);
        const status = await getStatus(tmpDir, "project");
        assert.equal(status.exists, true);
        assert.equal(status.isGit, true);
        assert.ok(status.commitCount >= 1);
        assert.equal(status.clean, true);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("writes memory entry and commits changes to Git", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-write-test-"));
        await initRepo(tmpDir, "project");
        const writeRes = await writeEntry(tmpDir, "Use vitest for testing", {
            file: "topics/notes.md",
            metadata: { source: "session_42" },
        });
        assert.ok(writeRes.committed);
        assert.ok(writeRes.hash);
        assert.equal(writeRes.entry.fact, "Use vitest for testing");
        assert.equal(writeRes.entry.metadata.source, "session_42");
        const fileContent = await readMemoryFile(tmpDir, "topics/notes.md");
        assert.ok(fileContent?.includes("Use vitest for testing"));
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("automatically creates new topic file and links it into MEMORY.md ## Index", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-topic-test-"));
        await initRepo(tmpDir, "project");
        await writeEntry(tmpDir, "Microservices communicate via gRPC", {
            file: "topics/architecture.md",
            metadata: { source: "arch_review" },
        });
        // Check new topic file created
        const archContent = await readMemoryFile(tmpDir, "topics/architecture.md");
        assert.ok(archContent?.includes("Microservices communicate via gRPC"));
        // Check MEMORY.md index was updated
        const memoryMd = await readMemoryFile(tmpDir, "MEMORY.md");
        assert.ok(memoryMd?.includes("- [[topics/architecture]]"));
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("detects broken wiki-links during repository scan", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-scan-test-"));
        await initRepo(tmpDir, "project");
        // Add broken link to MEMORY.md
        await updateIndex(tmpDir, "topics/non_existent_topic");
        const { brokenLinks } = await scanRepo(tmpDir, "project");
        assert.equal(brokenLinks.length, 1);
        assert.equal(brokenLinks[0].fromFile, "MEMORY.md");
        assert.equal(brokenLinks[0].link, "[[topics/non_existent_topic]]");
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("inserts entries into MEMORY.md BEFORE ## Index and makes them searchable", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-memorymd-test-"));
        await initRepo(tmpDir, "project");
        const writeRes = await writeEntry(tmpDir, "Critical invariant: Never push to main branch directly", {
            file: "MEMORY.md",
            metadata: { source: "policy" },
        });
        assert.ok(writeRes.committed);
        // Verify MEMORY.md content structure
        const memoryMdContent = await readMemoryFile(tmpDir, "MEMORY.md");
        assert.ok(memoryMdContent);
        const lines = memoryMdContent.split("\n");
        const indexIdx = lines.findIndex((l) => l.trim().startsWith("## Index"));
        const entryIdx = lines.findIndex((l) => l.includes("Critical invariant"));
        assert.ok(indexIdx > -1);
        assert.ok(entryIdx > -1);
        assert.ok(entryIdx < indexIdx, "Entry must be placed BEFORE ## Index");
        // Verify scanRepo parses this entry
        const { allEntries } = await scanRepo(tmpDir, "project");
        assert.ok(allEntries.some((e) => e.fact.includes("Critical invariant")));
        // Verify updateIndex never adds MEMORY to MEMORY.md Index
        const notAdded = await updateIndex(tmpDir, "MEMORY.md");
        assert.equal(notAdded, false);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=repo.test.js.map