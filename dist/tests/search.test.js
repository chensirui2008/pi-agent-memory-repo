import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initRepo, writeEntry } from "../src/core/repo.js";
import { recallMemories, scoreEntry, tokenize } from "../src/core/search.js";
describe("Search & Recall Tests", () => {
    it("tokenizes search query into clean terms", () => {
        const terms = tokenize("Node.js 26 --experimental-strip-types!");
        assert.ok(terms.includes("node"));
        assert.ok(terms.includes("26"));
        assert.ok(terms.includes("experimental-strip-types"));
    });
    it("scores entries with exact phrase and term matches", () => {
        const entry = {
            raw: "- Prefers concise responses [source: user; added: 2026-10-13]",
            fact: "Prefers concise responses",
            metadata: { source: "user", added: "2026-10-13" },
            links: [],
            file: "topics/preferences.md",
            absPath: "/tmp/fake",
            line: 1,
            scope: "global",
        };
        const s1 = scoreEntry(entry, "concise responses", ["concise", "responses"]);
        const s2 = scoreEntry(entry, "completely unrelated topic", ["unrelated"]);
        assert.ok(s1.score > s2.score);
        assert.equal(s2.score, 0);
    });
    it("recalls memories across both global and project scopes with scoping filters", async () => {
        const globalTmp = fs.mkdtempSync(path.join(os.tmpdir(), "search-global-"));
        const projectTmp = fs.mkdtempSync(path.join(os.tmpdir(), "search-project-"));
        process.env.AGENT_MEMORY_GLOBAL_DIR = globalTmp;
        process.env.AGENT_MEMORY_PROJECT_DIR = projectTmp;
        await initRepo(globalTmp, "global");
        await initRepo(projectTmp, "project");
        await writeEntry(globalTmp, "Always use lowercase with underscores for image names", {
            file: "topics/user_preferences.md",
            scope: "global",
            metadata: { source: "user" },
        });
        await writeEntry(projectTmp, "Use /opt/homebrew/bin/node for running scripts", {
            file: "topics/environment.md",
            scope: "project",
            metadata: { source: "project_setup" },
        });
        // 1. Recall across 'all' scopes
        const allResults = await recallMemories({ query: "image names", scope: "all" });
        assert.ok(allResults.length > 0);
        assert.equal(allResults[0].entry.scope, "global");
        assert.ok(allResults[0].entry.fact.includes("image names"));
        // 2. Recall project-specific fact
        const projResults = await recallMemories({ query: "homebrew node", scope: "project" });
        assert.ok(projResults.length > 0);
        assert.equal(projResults[0].entry.scope, "project");
        // 3. Filter strictly by scope
        const filterGlobal = await recallMemories({ query: "homebrew node", scope: "global" });
        assert.equal(filterGlobal.length, 0);
        // Clean up
        delete process.env.AGENT_MEMORY_GLOBAL_DIR;
        delete process.env.AGENT_MEMORY_PROJECT_DIR;
        fs.rmSync(globalTmp, { recursive: true, force: true });
        fs.rmSync(projectTmp, { recursive: true, force: true });
    });
    it("recalls Chinese memories accurately with CJK tokenization", async () => {
        const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "search-cjk-"));
        process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;
        await initRepo(tmpProject, "project");
        await writeEntry(tmpProject, "用户偏好使用TypeScript和严格类型检查", {
            file: "topics/user_preferences.md",
            metadata: { source: "user_zh" },
        });
        await writeEntry(tmpProject, "前端项目统一使用TailwindCSS样式库", {
            file: "topics/frontend.md",
            metadata: { source: "style_zh" },
        });
        // Query with Chinese phrase
        const res1 = await recallMemories({ query: "用户偏好", scope: "project" });
        assert.ok(res1.length > 0);
        assert.ok(res1[0].entry.fact.includes("TypeScript"));
        // Query with single Chinese concept
        const res2 = await recallMemories({ query: "TailwindCSS样式", scope: "project" });
        assert.ok(res2.length > 0);
        assert.ok(res2[0].entry.fact.includes("TailwindCSS"));
        delete process.env.AGENT_MEMORY_PROJECT_DIR;
        fs.rmSync(tmpProject, { recursive: true, force: true });
    });
});
//# sourceMappingURL=search.test.js.map