import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { handleInitCommand } from "../src/commands/init.js";
import { handleRememberCommand } from "../src/commands/remember.js";
import { handleDreamingCommand } from "../src/commands/dreaming.js";
import { handleStatusCommand } from "../src/commands/status.js";
import { memoryRecallTool } from "../src/tools/recall.js";
import { memoryWriteTool } from "../src/tools/write.js";
import { memoryReadTool } from "../src/tools/read.js";
import { memoryListTool } from "../src/tools/list.js";
import { buildMemoryContext } from "../src/index.js";
import extensionEntrypoint from "../src/index.js";
import { ExtensionAPI } from "../src/core/types.js";

describe("Slash Commands, Tools & Extension Tests", () => {
  let sandboxGlobal: string;
  let originalGlobal: string | undefined;
  beforeEach(() => {
    originalGlobal = process.env.AGENT_MEMORY_GLOBAL_DIR;
    sandboxGlobal = fs.mkdtempSync(path.join(os.tmpdir(), "cmd-global-isolated-"));
    process.env.AGENT_MEMORY_GLOBAL_DIR = sandboxGlobal;
  });
  afterEach(() => {
    if (originalGlobal === undefined) delete process.env.AGENT_MEMORY_GLOBAL_DIR;
    else process.env.AGENT_MEMORY_GLOBAL_DIR = originalGlobal;
    fs.rmSync(sandboxGlobal, { recursive: true, force: true });
  });
  it("executes /init memory command", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "cmd-init-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const logged: string[] = [];
    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => logged.push(msg),
        log: (msg: string) => logged.push(msg),
      },
    };

    await handleInitCommand("memory project", mockCtx);
    assert.ok(logged.some((m) => m.includes("Project Memory")));
    assert.equal(fs.existsSync(path.join(tmpProject, "MEMORY.md")), true);

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("executes /remember command with explicit argument and session fallback", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "cmd-rem-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const notified: string[] = [];
    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => notified.push(msg),
      },
      session: {
        messages: [
          { role: "user", content: "Remember: always add error handling to file readers" },
        ],
      },
    };

    // 1. With explicit text
    await handleRememberCommand("Prefers vitest for testing", mockCtx);
    assert.ok(notified.some((n) => n.includes("Prefers vitest for testing")));

    // 2. Without argument (infers from session)
    await handleRememberCommand("", mockCtx);
    assert.ok(notified.some((n) => n.includes("Summarized and stored")));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("executes /dreaming and /status commands", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "cmd-dream-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const notifications: string[] = [];
    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => notifications.push(msg),
      },
    };

    await handleInitCommand("project", mockCtx);
    await handleDreamingCommand("project", mockCtx);
    assert.ok(notifications.some((n) => n.includes("Agent Dreaming Consolidation Report")));

    await handleStatusCommand("", mockCtx);
    assert.ok(notifications.some((n) => n.includes("Agent Memory Repository Status")));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("executes memory_write, memory_recall, memory_read, and memory_list tools", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "tools-test-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const ctx = { workspaceDir: tmpProject };

    // 1. memory_write
    const writeRes = await memoryWriteTool.handler!(
      {
        content: "Configuration is stored in json format",
        file: "topics/config.md",
        scope: "project",
        source: "test_tool",
      },
      ctx
    );
    assert.ok(writeRes.content[0].text?.includes("Successfully saved memory entry"));

    // 2. memory_recall
    const recallRes = await memoryRecallTool.handler!(
      { query: "json configuration", scope: "project" },
      ctx
    );
    assert.ok(recallRes.content[0].text?.includes("Configuration is stored in json format"));

    // 3. memory_read
    const readRes = await memoryReadTool.handler!(
      { path: "topics/config", scope: "project" },
      ctx
    );
    assert.ok(readRes.content[0].text?.includes("Configuration is stored in json format"));

    // 4. memory_list
    const listRes = await memoryListTool.handler!({ scope: "project" }, ctx);
    assert.ok(listRes.content[0].text?.includes("MEMORY.md"));
    assert.ok(listRes.content[0].text?.includes("topics/config.md"));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("builds injected memory context and registers extension hooks", async () => {
    const tmpGlobal = fs.mkdtempSync(path.join(os.tmpdir(), "ext-global-"));
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "ext-project-"));
    process.env.AGENT_MEMORY_GLOBAL_DIR = tmpGlobal;
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    fs.writeFileSync(path.join(tmpGlobal, "MEMORY.md"), "# Global\n- Rule A\n", "utf8");
    fs.writeFileSync(path.join(tmpProject, "MEMORY.md"), "# Project\n- Rule B\n", "utf8");

    const injected = buildMemoryContext(tmpProject);
    assert.ok(injected.includes("<agent_memory>"));
    assert.ok(injected.includes("Rule A"));
    assert.ok(injected.includes("Rule B"));

    // Test extension registration
    const registeredTools: string[] = [];
    const registeredCommands: string[] = [];
    const registeredEvents: string[] = [];

    const mockPi: ExtensionAPI = {
      registerTool: (tool) => registeredTools.push(tool.name),
      registerCommand: (nameOrDef: any) => {
        const name = typeof nameOrDef === "string" ? nameOrDef : nameOrDef.name;
        registeredCommands.push(name);
      },
      on: (event) => registeredEvents.push(event),
    };

    extensionEntrypoint(mockPi);

    assert.ok(registeredTools.includes("memory_recall"));
    assert.ok(registeredTools.includes("memory_write"));
    assert.ok(registeredTools.includes("memory_read"));
    assert.ok(registeredTools.includes("memory_list"));

    assert.ok(registeredCommands.includes("init"));
    assert.ok(registeredCommands.includes("remember"));
    assert.ok(registeredCommands.includes("dreaming"));
    assert.ok(registeredCommands.includes("status"));

    assert.ok(registeredEvents.includes("context"));
    assert.ok(registeredEvents.includes("session_start"));

    delete process.env.AGENT_MEMORY_GLOBAL_DIR;
    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpGlobal, { recursive: true, force: true });
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("handles tool execute calls with 2 arguments (params, ctx) and 3 arguments (id, params, ctx)", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "tool-exec-sig-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const ctx = { workspaceDir: tmpProject };

    // 2-argument invocation: execute(params, ctx)
    const writeRes2 = await memoryWriteTool.execute!(
      { content: "Tool test rule", file: "topics/rules.md" },
      ctx
    );
    assert.equal(writeRes2.isError, undefined);

    const recallRes2 = await memoryRecallTool.execute!(
      { query: "Tool test rule" },
      ctx
    );
    assert.ok(recallRes2.content[0].text?.includes("Tool test rule"));

    // 3-argument invocation: execute(id, params, ctx)
    const readRes3 = await memoryReadTool.execute!(
      "call-123",
      { path: "topics/rules.md" },
      ctx
    );
    assert.ok(readRes3.content[0].text?.includes("Tool test rule"));

    const listRes3 = await memoryListTool.execute!(
      "call-124",
      { scope: "project" },
      ctx
    );
    assert.ok(listRes3.content[0].text?.includes("topics/rules.md"));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("handles concurrent git commits safely without index.lock errors", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "concurrent-git-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const ctx = { workspaceDir: tmpProject };
    await handleInitCommand("project", ctx);

    // Run parallel writes to the memory repo
    const promises = [
      memoryWriteTool.execute!({ content: "Concurrent write 1", file: "topics/c1.md" }, ctx),
      memoryWriteTool.execute!({ content: "Concurrent write 2", file: "topics/c2.md" }, ctx),
      memoryWriteTool.execute!({ content: "Concurrent write 3", file: "topics/c3.md" }, ctx),
    ];

    const results = await Promise.all(promises);
    for (const r of results) {
      assert.equal(r.isError, undefined);
    }

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("supports /remember with explicit global scope and block array messages", async () => {
    const tmpGlobal = fs.mkdtempSync(path.join(os.tmpdir(), "rem-glob-"));
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "rem-proj-"));
    process.env.AGENT_MEMORY_GLOBAL_DIR = tmpGlobal;
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const logged: string[] = [];
    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => logged.push(msg),
        log: (msg: string) => logged.push(msg),
      },
      session: {
        messages: [
          {
            role: "assistant",
            content: [{ type: "text", text: "记住：项目中所有的单元测试必须在CI中运行" }],
          },
        ],
      },
    };

    // 1. Explicit global scope argument
    await handleRememberCommand("global 用户偏好使用暗黑主题", mockCtx);
    assert.ok(logged.some((m) => m.includes("[global]")));

    // 2. Extract from block array message
    await handleRememberCommand("", mockCtx);
    assert.ok(logged.some((m) => m.includes("单元测试必须在CI中运行")));

    delete process.env.AGENT_MEMORY_GLOBAL_DIR;
    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpGlobal, { recursive: true, force: true });
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });
});
