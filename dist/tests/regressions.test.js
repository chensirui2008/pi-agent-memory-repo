import { it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initRepo, readMemoryFile, writeEntry, getStatus, scanRepo } from "../src/core/repo.js";
import { runDreaming } from "../src/core/dreaming.js";
import { parseMemoryFile } from "../src/core/parser.js";
import extension, { memoryWriteTool, memoryReadTool, memoryListTool, memoryRecallTool } from "../src/index.js";
import { handleRememberCommand } from "../src/commands/remember.js";
it("consolidation preserves independent entries with shared or absent sources", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "identity-"));
    try {
        await initRepo(root, "project");
        for (const source of ["user_remember", undefined]) {
            const file = `topics/${source || "no-source"}.md`;
            const text = "# Notes\n\nKeep this paragraph.\n\n" + [
                "Always use PostgreSQL for production database",
                "Always use PostgreSQL for production database",
                "Run eslint before every commit",
            ].map(fact => `- ${fact}${source ? ` [source: ${source}]` : ""}`).join("\n") + "\n";
            fs.writeFileSync(path.join(root, file), text);
        }
        await runDreaming(root, "project");
        for (const file of ["topics/user_remember.md", "topics/no-source.md"]) {
            const text = (await readMemoryFile(root, file));
            const entries = parseMemoryFile(text, file, root, "project").entries;
            assert.equal(entries.length, 2);
            assert.ok(entries.some(e => e.fact === "Run eslint before every commit"));
            assert.ok(text.includes("Keep this paragraph."));
        }
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
it("high similarity contradictions retain the newer rule", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "contradiction-"));
    try {
        await initRepo(root, "project");
        for (const [prefix, date] of [["Always", "2026-10-10"], ["Never", "2026-10-13"]]) {
            await writeEntry(root, `${prefix} use tabs for indentation in all TypeScript source files`, {
                metadata: { added: date },
            });
        }
        const report = await runDreaming(root, "project");
        assert.equal(report.duplicatesMerged, 0);
        assert.equal(report.contradictionsResolved, 1);
        const { allEntries } = await scanRepo(root, "project");
        assert.equal(allEntries.find(e => e.fact.startsWith("Always use tabs"))?.metadata.status, "superseded");
        assert.equal(allEntries.find(e => e.fact.startsWith("Never use tabs"))?.metadata.status, undefined);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
it("repeated dreaming creates no extra patterns or commits", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "patterns-"));
    try {
        await initRepo(root, "project");
        await writeEntry(root, "React TypeScript components need keyboard accessibility", { file: "topics/ui.md" });
        await writeEntry(root, "React TypeScript rendering performance requires profiling", { file: "topics/performance.md" });
        const first = await runDreaming(root, "project");
        assert.ok(first.patternsSynthesized >= 2);
        const before = await readMemoryFile(root, "topics/patterns.md");
        const commits = (await getStatus(root, "project")).commitCount;
        for (let i = 0; i < 2; i++) {
            const next = await runDreaming(root, "project");
            assert.equal(next.patternsSynthesized, 0);
            assert.deepEqual(next.filesModified, []);
            assert.equal(next.commitHash, undefined);
            assert.equal(await readMemoryFile(root, "topics/patterns.md"), before);
            assert.equal((await getStatus(root, "project")).commitCount, commits);
        }
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
it("rejects traversal, absolute paths, and file/directory symlink escapes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "path-guard-"));
    const repo = path.join(root, "memory");
    const outside = path.join(root, "outside.md");
    try {
        fs.writeFileSync(outside, "unchanged");
        await initRepo(repo, "project");
        fs.symlinkSync(root, path.join(repo, "escape"));
        fs.symlinkSync(outside, path.join(repo, "linked.md"));
        fs.symlinkSync(path.join(root, "missing.md"), path.join(repo, "dangling.md"));
        const commits = (await getStatus(repo, "project")).commitCount;
        for (const file of ["../outside.md", "topics/../../outside.md", outside, "\\..\\outside.md", "C:\\outside.md", "escape/outside.md", "escape/new/deep.md", "linked.md", "dangling.md"]) {
            await assert.rejects(writeEntry(repo, "overwrite", { file }));
            await assert.rejects(readMemoryFile(repo, file));
        }
        assert.equal(fs.readFileSync(outside, "utf8"), "unchanged");
        assert.equal(fs.existsSync(path.join(root, "new")), false);
        assert.equal((await getStatus(repo, "project")).commitCount, commits);
        await writeEntry(repo, "safe", { file: "./topics/nested/safe" });
        assert.ok((await readMemoryFile(repo, "topics/nested/safe"))?.includes("safe"));
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
it("five-argument tools use session cwd without project env override", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-tools-"));
    const previous = process.env.AGENT_MEMORY_PROJECT_DIR;
    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    try {
        const args = [new AbortController().signal, () => { }, { cwd: root }];
        const write = await memoryWriteTool.execute("write", { content: "unique session cwd fact", file: "topics/isolated.md" }, ...args);
        assert.equal(write.isError, undefined);
        assert.ok(fs.existsSync(path.join(root, ".pi/memory/topics/isolated.md")));
        const read = await memoryReadTool.execute("read", { path: "topics/isolated.md" }, ...args);
        assert.ok(read.content[0].text?.includes("unique session cwd fact"));
        const recall = await memoryRecallTool.execute("recall", { query: "unique session cwd fact", scope: "project" }, ...args);
        assert.ok(recall.content[0].text?.includes("unique session cwd fact"));
        const list = await memoryListTool.execute("list", { scope: "project" }, ...args);
        assert.ok(list.content[0].text?.includes(path.join(root, ".pi/memory")));
    }
    finally {
        if (previous === undefined)
            delete process.env.AGENT_MEMORY_PROJECT_DIR;
        else
            process.env.AGENT_MEMORY_PROJECT_DIR = previous;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
it("remember extracts only message entries from the current session branch", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-remember-"));
    const previous = process.env.AGENT_MEMORY_PROJECT_DIR;
    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    try {
        await handleRememberCommand("", {
            cwd: root,
            session: [{ content: "Remember: obsolete fallback rule" }],
            sessionManager: { getBranch: () => [
                    { type: "custom", message: { content: "Remember: wrong custom record" } },
                    { type: "message", message: { role: "user", content: "Remember: validate database migrations" } },
                    { type: "message", message: { role: "assistant", content: [{ type: "text", text: "决定使用事务处理数据库迁移" }] } },
                ] },
        });
        const text = (await readMemoryFile(path.join(root, ".pi/memory"), "topics/session_notes.md"));
        assert.ok(text.includes("validate database migrations"));
        assert.ok(text.includes("决定使用事务处理数据库迁移"));
        assert.ok(!text.includes("checkpoint"));
        assert.ok(!text.includes("obsolete") && !text.includes("wrong custom"));
    }
    finally {
        if (previous === undefined)
            delete process.env.AGENT_MEMORY_PROJECT_DIR;
        else
            process.env.AGENT_MEMORY_PROJECT_DIR = previous;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
it("context lifecycle uses second-argument cwd and returns valid Pi messages", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-context-"));
    const oldProject = process.env.AGENT_MEMORY_PROJECT_DIR;
    const oldGlobal = process.env.AGENT_MEMORY_GLOBAL_DIR;
    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    process.env.AGENT_MEMORY_GLOBAL_DIR = path.join(root, "global");
    try {
        const memoryDir = path.join(root, ".pi/memory");
        fs.mkdirSync(memoryDir, { recursive: true });
        fs.writeFileSync(path.join(memoryDir, "MEMORY.md"), "# session cwd sentinel");
        const hooks = new Map();
        extension({ registerTool() { }, registerCommand() { }, on: (event, handler) => { hooks.set(event, handler); } });
        await hooks.get("session_start")({ type: "session_start", reason: "startup" }, { cwd: root });
        const event = { type: "context", messages: [{ role: "user", content: "hello" }] };
        const result = await hooks.get("context")(event, { cwd: root });
        assert.ok(result.messages[0].content.includes("session cwd sentinel"));
        assert.equal(result.messages[0].role, "custom");
        assert.equal(result.messages[0].display, false);
        assert.equal(event.messages.length, 1);
        const repeat = await hooks.get("context")({ type: "context", messages: result.messages }, { cwd: root });
        assert.equal(repeat.messages.length, 2);
    }
    finally {
        if (oldProject === undefined)
            delete process.env.AGENT_MEMORY_PROJECT_DIR;
        else
            process.env.AGENT_MEMORY_PROJECT_DIR = oldProject;
        if (oldGlobal === undefined)
            delete process.env.AGENT_MEMORY_GLOBAL_DIR;
        else
            process.env.AGENT_MEMORY_GLOBAL_DIR = oldGlobal;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=regressions.test.js.map