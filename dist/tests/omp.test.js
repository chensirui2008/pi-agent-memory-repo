import { afterEach, beforeEach, describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import registerOmp from "../src/omp.js";
import registerPi from "../src/index.js";
import { buildMemoryContext } from "../src/core/context.js";
import { initRepo, writeEntry } from "../src/core/repo.js";
import { distillOmpMemories, handleOmpRememberCommand, selectOmpMemories } from "../src/commands/omp-remember.js";
function host() {
    const tools = [];
    const commands = new Map();
    const events = new Map();
    const output = [];
    const api = {
        registerTool: tool => tools.push(tool),
        registerCommand: (name, options) => {
            assert.equal(commands.has(name), false);
            commands.set(name, options);
        },
        on: (event, handler) => events.set(event, handler),
        sendMessage: message => { output.push(message.content); },
    };
    registerOmp(api);
    return { tools, commands, events, output };
}
const messages = [{ role: "user", content: "Remember: use disposable directories for tests" }];
const candidate = { fact: "Use strict TypeScript", scope: "project", file: "topics/architecture.md" };
describe("OMP adapter", () => {
    let root;
    let oldGlobal;
    let oldProject;
    let ctx;
    let output;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "omp-memory-test-"));
        oldGlobal = process.env.AGENT_MEMORY_GLOBAL_DIR;
        oldProject = process.env.AGENT_MEMORY_PROJECT_DIR;
        process.env.AGENT_MEMORY_GLOBAL_DIR = path.join(root, "global");
        process.env.AGENT_MEMORY_PROJECT_DIR = path.join(root, "project");
        output = [];
        ctx = { cwd: root, mode: "print", hasUI: false, messages, ui: { notify: message => output.push(message) } };
    });
    afterEach(() => {
        if (oldGlobal === undefined)
            delete process.env.AGENT_MEMORY_GLOBAL_DIR;
        else
            process.env.AGENT_MEMORY_GLOBAL_DIR = oldGlobal;
        if (oldProject === undefined)
            delete process.env.AGENT_MEMORY_PROJECT_DIR;
        else
            process.env.AGENT_MEMORY_PROJECT_DIR = oldProject;
        fs.rmSync(root, { recursive: true, force: true });
    });
    it("registers only four tools and four commands with OMP approval tiers", () => {
        const h = host();
        assert.deepEqual([...h.commands.keys()], ["init-memory", "memory-status", "remember", "dreaming"]);
        assert.equal(h.tools.length, 4);
        for (const tool of h.tools)
            assert.equal(tool.approval, tool.name === "memory_write" ? "write" : "read");
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), false);
    });
    it("injects once, preserves other prompts, freezes until the next session and never initializes", async () => {
        const h = host();
        const inject = (systemPrompt) => h.events.get("before_agent_start")({ systemPrompt }, ctx).systemPrompt;
        h.events.get("session_start")({}, ctx);
        assert.deepEqual(inject(["base", "other extension"]), ["base", "other extension"]);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_GLOBAL_DIR), false);
        await writeEntry(process.env.AGENT_MEMORY_PROJECT_DIR, "First fact", { file: "MEMORY.md" });
        assert.equal(inject(["base"]).length, 1);
        h.events.get("session_start")({}, ctx);
        const first = inject(["base", "other extension"]);
        assert.equal(first.length, 3);
        assert.match(first[2], /First fact/);
        assert.deepEqual(inject(first), first);
        await writeEntry(process.env.AGENT_MEMORY_PROJECT_DIR, "Later fact", { file: "MEMORY.md" });
        assert.deepEqual(inject(first), first);
        h.events.get("session_switch")({}, ctx);
        assert.match(inject(first)[2], /Later fact/);
    });
    it("reports read failures and retains the readable scope", () => {
        fs.mkdirSync(path.join(process.env.AGENT_MEMORY_GLOBAL_DIR, "MEMORY.md"), { recursive: true });
        fs.mkdirSync(process.env.AGENT_MEMORY_PROJECT_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.AGENT_MEMORY_PROJECT_DIR, "MEMORY.md"), "Project content");
        const diagnostics = [];
        assert.match(buildMemoryContext(root, error => diagnostics.push(error)), /Project content/);
        assert.equal(diagnostics.length, 1);
    });
    it("shares writes and reads with Pi in both directions and both scopes", async () => {
        const h = host();
        const piTools = [];
        registerPi({ registerTool: tool => piTools.push(tool), registerCommand: () => { } });
        const piWrite = piTools.find(tool => tool.name === "memory_write");
        const ompRead = h.tools.find(tool => tool.name === "memory_read");
        const ompWrite = h.tools.find(tool => tool.name === "memory_write");
        const piRecall = piTools.find(tool => tool.name === "memory_recall");
        for (const scope of ["global", "project"]) {
            await piWrite.execute("pi", { content: `Pi shared ${scope}`, file: "topics/notes.md", scope }, undefined, undefined, ctx);
            const read = await ompRead.execute("omp", { path: "topics/notes.md", scope }, undefined, undefined, ctx);
            assert.match(read.content[0].text, new RegExp(`Pi shared ${scope}`));
            await ompWrite.execute("omp", { content: `OMP shared ${scope}`, scope }, undefined, undefined, ctx);
            const recall = await piRecall.handler({ query: "OMP shared", scope }, ctx);
            assert.match(recall.content[0].text, new RegExp(`OMP shared ${scope}`));
        }
    });
    it("saves only explicit notes headlessly, including scope-only parsing", async () => {
        ctx.runEphemeralTurn = async () => { throw new Error("Must not extract explicit notes"); };
        await handleOmpRememberCommand("global User prefers concise replies", ctx);
        assert.match(fs.readFileSync(path.join(process.env.AGENT_MEMORY_GLOBAL_DIR, "topics/user_preferences.md"), "utf8"), /concise replies/);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), false);
        await handleOmpRememberCommand("project", ctx);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), false);
        assert.ok(output.some(text => text.includes("review only")));
    });
    it("automatic headless proposals and empty results never write placeholders", async () => {
        await handleOmpRememberCommand("", ctx);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), false);
        assert.ok(output.some(text => text.includes("heuristic")));
        ctx.model = {};
        ctx.runEphemeralTurn = async () => ({ replyText: "[]" });
        await handleOmpRememberCommand("", ctx);
        assert.match(output.at(-1), /No durable memories/);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), false);
    });
    it("uses the current model in a tool-free ephemeral turn", async () => {
        ctx.model = {};
        ctx.runEphemeralTurn = async (options) => {
            assert.equal(options.tools, false);
            assert.match(options.promptText, /disposable directories/);
            assert.equal(options.signal.aborted, false);
            return { replyText: JSON.stringify([candidate]) };
        };
        const result = await distillOmpMemories(ctx, messages);
        assert.equal(result.items[0].scope, "project");
        assert.equal(result.fallback, undefined);
    });
    it("falls back on missing models, invalid JSON, invalid paths and call errors", async () => {
        for (const reply of ["not json", JSON.stringify([{ ...candidate, file: "../escape.md" }]), JSON.stringify([{ ...candidate, fact: "a\nb" }])]) {
            ctx.model = {};
            ctx.runEphemeralTurn = async () => ({ replyText: reply });
            const result = await distillOmpMemories(ctx, messages);
            assert.match(result.fallback, /heuristic/);
            assert.equal(result.items[0].fact, "use disposable directories for tests");
        }
        ctx.runEphemeralTurn = async () => { throw new Error("provider failure"); };
        assert.match((await distillOmpMemories(ctx, messages)).fallback, /provider failure/);
        ctx.model = undefined;
        assert.match((await distillOmpMemories(ctx, messages)).fallback, /model unavailable/);
    });
    it("aborts after timeout even when the provider does not settle", async () => {
        ctx.model = {};
        let signal;
        ctx.runEphemeralTurn = async (options) => { signal = options.signal; return new Promise(() => { }); };
        const result = await distillOmpMemories(ctx, messages, 10);
        assert.equal(signal.aborted, true);
        assert.match(result.fallback, /timed out/);
    });
    it("supports native individual toggles, save and cancellation", async () => {
        const items = (await distillOmpMemories(ctx, messages)).items;
        items.push({ ...items[0], id: "2", fact: "Second fact" });
        ctx.mode = "tui";
        ctx.hasUI = true;
        let calls = 0;
        ctx.ui.select = async (_title, options, dialog) => {
            if (calls++ === 0)
                return options[0];
            assert.deepEqual(dialog.checkedIndices, [1]);
            return "Save selected memories";
        };
        assert.deepEqual(await selectOmpMemories(items, ctx), [items[1]]);
        ctx.ui.select = async () => undefined;
        assert.deepEqual(await selectOmpMemories(items, ctx), []);
        await handleOmpRememberCommand("project Explicit cancelled note", ctx);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), false);
    });
    it("shows full proposals and requires explicit confirmation in interactive RPC", async () => {
        ctx.mode = "rpc";
        ctx.hasUI = true;
        ctx.ui.confirm = async (_title, proposal) => {
            assert.match(proposal, /Explicit RPC note/);
            return false;
        };
        await handleOmpRememberCommand("project Explicit RPC note", ctx);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), false);
        ctx.ui.confirm = async () => true;
        await handleOmpRememberCommand("project Explicit RPC note", ctx);
        assert.equal(fs.existsSync(process.env.AGENT_MEMORY_PROJECT_DIR), true);
    });
    it("headless RPC saves explicit notes without calling no-op dialogs", async () => {
        ctx.mode = "rpc";
        ctx.ui.confirm = async () => { throw new Error("headless dialog"); };
        const h = host();
        await h.commands.get("remember").handler("project Headless RPC note", ctx);
        assert.ok(h.output.some(text => text.includes("Saved")));
        await h.commands.get("remember").handler("", ctx);
        assert.ok(h.output.some(text => text.includes("review only")));
    });
    it("reports files written separately from failed Git commits in commands and tools", async () => {
        const repo = process.env.AGENT_MEMORY_PROJECT_DIR;
        await initRepo(repo, "project");
        fs.writeFileSync(path.join(repo, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
        await handleOmpRememberCommand("project File persists despite failed commit", ctx);
        assert.match(output.at(-1), /File written.*Git commit incomplete/);
        assert.match(fs.readFileSync(path.join(repo, "topics/session_notes.md"), "utf8"), /File persists/);
        const tool = host().tools.find(tool => tool.name === "memory_write");
        const result = await tool.handler({ content: "Tool file persists" }, ctx);
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /File written.*Git commit incomplete/);
    });
    it("reports initialization files when Git is unavailable", async () => {
        const oldPath = process.env.PATH;
        try {
            process.env.PATH = root;
            const h = host();
            await h.commands.get("init-memory").handler("project", ctx);
            assert.ok(h.output.some(text => text.includes("Files written") && text.includes("Git commit incomplete")));
            assert.equal(fs.existsSync(path.join(process.env.AGENT_MEMORY_PROJECT_DIR, "MEMORY.md")), true);
        }
        finally {
            if (oldPath === undefined)
                delete process.env.PATH;
            else
                process.env.PATH = oldPath;
        }
    });
    it("reports consolidation files separately from failed commits", async () => {
        const repo = process.env.AGENT_MEMORY_PROJECT_DIR;
        await initRepo(repo, "project");
        await writeEntry(repo, "Always use disposable test directories", { file: "topics/testing_rules.md" });
        await writeEntry(repo, "Always use disposable test directories", { file: "topics/testing_rules.md" });
        fs.writeFileSync(path.join(repo, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
        const h = host();
        await h.commands.get("dreaming").handler("project", ctx);
        assert.ok(h.output.some(text => text.includes("Files written, but Git commit incomplete")));
    });
    it("resolves default project paths from cwd without creating memory during load", async () => {
        delete process.env.AGENT_MEMORY_PROJECT_DIR;
        const h = host();
        h.events.get("session_start")({}, ctx);
        assert.equal(fs.existsSync(path.join(root, ".pi/memory")), false);
        await h.commands.get("remember").handler("project Workspace note", ctx);
        assert.equal(fs.existsSync(path.join(root, ".pi/memory/topics/session_notes.md")), true);
    });
});
//# sourceMappingURL=omp.test.js.map