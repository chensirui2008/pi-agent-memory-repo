import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { extractWikiLinks, formatEntry, formatMetadataBlock, parseEntry, parseMemoryFile, parseMetadataBlock, resolveWikiLink, } from "../src/core/parser.js";
describe("Parser & WikiLink Tests", () => {
    it("parses metadata block with multiple key-value pairs", () => {
        const block = "source: session_105; added: 2026-10-13; confidence: high";
        const meta = parseMetadataBlock(block);
        assert.equal(meta.source, "session_105");
        assert.equal(meta.added, "2026-10-13");
        assert.equal(meta.confidence, "high");
    });
    it("formats metadata block and single-line entry", () => {
        const meta = { source: "test_suite", added: "2026-10-13" };
        const formattedMeta = formatMetadataBlock(meta);
        assert.equal(formattedMeta, " [source: test_suite; added: 2026-10-13]");
        const entryLine = formatEntry("User prefers strict TypeScript", meta);
        assert.equal(entryLine, "- User prefers strict TypeScript [source: test_suite; added: 2026-10-13]");
    });
    it("extracts wiki-links with [[target]] syntax", () => {
        const text = "Check [[topics/architecture]] and refer to [[scripts/bench.sh]] for details.";
        const links = extractWikiLinks(text);
        assert.deepEqual(links, ["topics/architecture", "scripts/bench.sh"]);
    });
    it("parses single-line bullet entries with embedded metadata and links", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "parser-test-"));
        const line = "- Ghost text is used for autocomplete [[topics/editor]] [source: s10; added: 2026-10-13]";
        const entry = parseEntry(line, "MEMORY.md", 12, "project", tmpDir);
        assert.ok(entry);
        if (!entry)
            return;
        assert.equal(entry.fact, "Ghost text is used for autocomplete [[topics/editor]]");
        assert.equal(entry.metadata.source, "s10");
        assert.equal(entry.metadata.added, "2026-10-13");
        assert.equal(entry.links.length, 1);
        assert.equal(entry.links[0].target, "topics/editor");
        assert.equal(entry.line, 12);
        assert.equal(entry.scope, "project");
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("resolves wiki-links: appends .md to extensionless links and checks disk presence", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wikilink-test-"));
        const topicsDir = path.join(tmpDir, "topics");
        fs.mkdirSync(topicsDir, { recursive: true });
        fs.writeFileSync(path.join(topicsDir, "arch.md"), "# Architecture\n", "utf8");
        fs.writeFileSync(path.join(tmpDir, "run.sh"), "#!/bin/sh\n", "utf8");
        // Markdown file without extension
        const r1 = resolveWikiLink("topics/arch", tmpDir);
        assert.equal(r1.exists, true);
        assert.equal(r1.resolvedPath, path.join(topicsDir, "arch.md"));
        // Non-markdown file with extension
        const r2 = resolveWikiLink("run.sh", tmpDir);
        assert.equal(r2.exists, true);
        assert.equal(r2.resolvedPath, path.join(tmpDir, "run.sh"));
        // Missing target
        const r3 = resolveWikiLink("topics/nonexistent", tmpDir);
        assert.equal(r3.exists, false);
        // Link with anchor
        const r4 = resolveWikiLink("topics/arch#header", tmpDir);
        assert.equal(r4.exists, true);
        assert.equal(r4.resolvedPath, path.join(topicsDir, "arch.md"));
        // Link with pipe alias
        const r5 = resolveWikiLink("topics/arch|Architecture", tmpDir);
        assert.equal(r5.exists, true);
        assert.equal(r5.resolvedPath, path.join(topicsDir, "arch.md"));
        // Directory traversal attempt
        const r6 = resolveWikiLink("../outside", tmpDir);
        assert.equal(r6.exists, false);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("sanitizes bullet prefixes and internal newlines in formatEntry", () => {
        // Strips leading - / * / + / 1.
        const e1 = formatEntry("- Already has bullet", { source: "test" });
        assert.equal(e1, "- Already has bullet [source: test]");
        const e2 = formatEntry("* Asterisk bullet", { source: "test" });
        assert.equal(e2, "- Asterisk bullet [source: test]");
        const e3 = formatEntry("1. Numbered bullet", { source: "test" });
        assert.equal(e3, "- Numbered bullet [source: test]");
        // Collapses internal newlines into single line
        const e4 = formatEntry("Line 1\nLine 2\nLine 3", { added: "2026-10-13" });
        assert.equal(e4, "- Line 1 Line 2 Line 3 [added: 2026-10-13]");
    });
    it("parses full MEMORY.md file with title, entries, and ## Index", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memfile-test-"));
        const fileContent = `# Agent Memory: Test Project

- Core rule 1 [added: 2026-10-13]
- Core rule 2 [source: init; added: 2026-10-13]

## Index
- [[topics/notes]]
- [[topics/arch]]
`;
        const memFile = parseMemoryFile(fileContent, "MEMORY.md", tmpDir, "project");
        assert.equal(memFile.title, "Agent Memory: Test Project");
        assert.equal(memFile.entries.length, 2);
        assert.equal(memFile.indexLinks.length, 2);
        assert.equal(memFile.indexLinks[0].target, "topics/notes");
        assert.equal(memFile.indexLinks[1].target, "topics/arch");
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=parser.test.js.map