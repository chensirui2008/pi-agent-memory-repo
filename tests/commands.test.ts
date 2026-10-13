import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { handleInitCommand } from "../src/commands/init.js";
import { createMemoryProposalComponent, presentMemoryProposal, handleRememberCommand } from "../src/commands/remember.js";
import { handleDreamingCommand } from "../src/commands/dreaming.js";
import { handleStatusCommand } from "../src/commands/status.js";
import { memoryRecallTool } from "../src/tools/recall.js";
import { memoryWriteTool } from "../src/tools/write.js";
import { memoryReadTool } from "../src/tools/read.js";
import { memoryListTool } from "../src/tools/list.js";
import { buildMemoryContext } from "../src/index.js";
import extensionEntrypoint from "../src/index.js";
import { visibleWidth } from "@mariozechner/pi-tui";
import { ExtensionAPI, ProposedMemoryEntry, ProposalResult } from "../src/core/types.js";

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

  it("presents TUI proposal via ctx.ui.custom and commits memories upon user approval (Enter/y)", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "tui-rem-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const notified: string[] = [];
    let customRenderedLines: string[] = [];
    let customHandled = false;

    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => notified.push(msg),
        custom: async (factory: any) => {
          let doneResult: any = null;
          const mockTui = { requestRender: () => {} };
          const mockTheme = {
            fg: (_col: string, s: string) => s,
            bold: (s: string) => `*${s}*`,
            dim: (s: string) => s,
          };
          const component = factory(mockTui, mockTheme, {}, (res: any) => {
            doneResult = res;
          });

          // Test rendering
          customRenderedLines = component.render(80);

          // Test user approving with Enter
          component.handleInput("\r");
          customHandled = true;
          return doneResult;
        },
      },
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            message: {
              role: "user",
              content: "Remember: always enforce strict type-checking in TypeScript files",
            },
          },
        ],
      },
    };

    await handleRememberCommand("", mockCtx);

    assert.equal(customHandled, true);
    assert.ok(customRenderedLines.some((l) => l.includes("Memory Proposal")));
    assert.ok(customRenderedLines.some((l) => l.includes("enforce strict type-checking")));
    assert.ok(notified.some((n) => n.includes("Summarized and stored")));

    // Verify written to disk
    const targetFile = path.join(tmpProject, "topics/session_notes.md");
    assert.ok(fs.existsSync(targetFile));
    const content = fs.readFileSync(targetFile, "utf8");
    assert.ok(content.includes("enforce strict type-checking"));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("discards TUI proposal when user cancels via Esc or 'n', writing nothing", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "tui-cancel-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const notified: string[] = [];
    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => notified.push(msg),
        custom: async (factory: any) => {
          let doneResult: any = null;
          const mockTui = { requestRender: () => {} };
          const component = factory(mockTui, null, {}, (res: any) => {
            doneResult = res;
          });

          // User presses 'n' to reject
          component.handleInput("n");
          return doneResult;
        },
      },
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            message: {
              role: "user",
              content: "Remember: temporary secret that must not be committed",
            },
          },
        ],
      },
    };

    await handleRememberCommand("", mockCtx);

    assert.ok(notified.some((n) => n.includes("proposal discarded")));

    // Verify nothing written
    const targetFile = path.join(tmpProject, "topics/session_notes.md");
    assert.equal(fs.existsSync(targetFile), false);

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("supports interactive toggle in TUI component so only selected items are committed", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "tui-toggle-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const notified: string[] = [];
    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => notified.push(msg),
        custom: async (factory: any) => {
          let doneResult: any = null;
          const mockTui = { requestRender: () => {} };
          const component = factory(mockTui, null, {}, (res: any) => {
            doneResult = res;
          });

          // Focused on item 0: press space to unselect item 0
          component.handleInput(" ");
          // Press down arrow to move to item 1
          component.handleInput("\x1b[B");
          // Press 'y' to approve remaining selected items
          component.handleInput("y");
          return doneResult;
        },
      },
      session: {
        messages: [
          { role: "user", content: "Remember: item 1 to unselect" },
          { role: "assistant", content: "Remember: item 2 to keep and save" },
        ],
      },
    };

    await handleRememberCommand("", mockCtx);

    assert.ok(notified.some((n) => n.includes("Summarized and stored 1 session learnings")));

    const content = fs.readFileSync(path.join(tmpProject, "topics/session_notes.md"), "utf8");
    assert.equal(content.includes("item 1 to unselect"), false);
    assert.ok(content.includes("item 2 to keep and save"));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("handles ctx.ui.confirm approval and rejection flows", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "confirm-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const notified: string[] = [];
    let confirmPromptShown = "";
    let shouldApprove = false;

    const mockCtx = {
      workspaceDir: tmpProject,
      ui: {
        notify: (msg: string) => notified.push(msg),
        confirm: async (_title: string, prompt: string) => {
          confirmPromptShown = prompt;
          return shouldApprove;
        },
      },
      session: {
        messages: [{ role: "user", content: "Note: testing rules for unit tests" }],
      },
    };

    // 1. Rejected
    shouldApprove = false;
    await handleRememberCommand("", mockCtx);
    assert.ok(confirmPromptShown.includes("testing rules for unit tests"));
    assert.ok(notified.some((n) => n.includes("proposal discarded")));
    assert.equal(fs.existsSync(path.join(tmpProject, "topics/testing_rules.md")), false);

    // 2. Approved
    shouldApprove = true;
    await handleRememberCommand("", mockCtx);
    assert.ok(notified.some((n) => n.includes("Summarized and stored")));
    assert.ok(fs.existsSync(path.join(tmpProject, "topics/testing_rules.md")));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("summarizes conversation with modelRegistry when model is available", async () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "model-proj-"));
    process.env.AGENT_MEMORY_PROJECT_DIR = tmpProject;

    const notified: string[] = [];
    const mockCtx = {
      workspaceDir: tmpProject,
      model: { id: "test-model", provider: "mock" },
      modelRegistry: {
        complete: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify([
                {
                  fact: "Custom architecture requires pure functional components",
                  scope: "project",
                  file: "topics/architecture.md",
                  reason: "architecture invariant",
                },
              ]),
            },
          ],
        }),
      },
      ui: {
        notify: (msg: string) => notified.push(msg),
        confirm: async () => true,
      },
      session: {
        messages: [
          { role: "user", content: "How should we design the UI components?" },
          { role: "assistant", content: "We decided to keep everything pure and functional." },
        ],
      },
    };

    await handleRememberCommand("", mockCtx);

    assert.ok(notified.some((n) => n.includes("Custom architecture requires pure functional components")));
    const archFile = path.join(tmpProject, "topics/architecture.md");
    assert.ok(fs.existsSync(archFile));
    const content = fs.readFileSync(archFile, "utf8");
    assert.ok(content.includes("Custom architecture requires pure functional components"));

    delete process.env.AGENT_MEMORY_PROJECT_DIR;
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });
});



describe("Memory proposal terminal and RPC compatibility", () => {
  const items: ProposedMemoryEntry[] = [
    { id: "1", fact: "中文 🧠 👩‍💻 e\u0301 " + "long-unbroken-fact".repeat(8), file: "topics/" + "long-path".repeat(12) + ".md", scope: "project", selected: true },
    { id: "2", fact: "Second memory", file: "topics/session_notes.md", scope: "global", selected: true },
  ];

  it("keeps every rendered line within the available terminal columns", () => {
    const component = createMemoryProposalComponent(items, null, null, () => {});
    for (const width of [0, 1, 4, 5, 10, 20, 40, 60, 80, 100, 120]) {
      const lines = component.render(width);
      if (width >= 5) assert.ok(lines.length > 0);
      for (const line of lines) {
        assert.ok(visibleWidth(line) <= width, `width ${width}: ${visibleWidth(line)} columns`);
      }
      assert.ok(lines.every((line) => !line.includes("\n")));
    }
    const text = component.render(40).join("\n");
    assert.ok(text.includes("Navigate"));
    assert.ok(text.includes("Cancel"));
  });

  it("accepts Kitty Enter, Escape and Space, and application-mode arrows", () => {
    let result: ProposalResult | undefined;
    const component = createMemoryProposalComponent(items, null, null, (res) => { result = res; });
    component.handleInput("\x1bOB");
    component.handleInput("\x1b[32u"); // Unselect second item
    component.handleInput("\x1bOA");
    component.handleInput("\x1b[32u"); // Unselect first item
    component.handleInput("\x1bOB"); // Application-mode down
    component.handleInput("\x1b[32u"); // Select second item
    component.handleInput("\x1b[13u");
    assert.equal(result?.confirmed, true);
    assert.deepEqual(result?.approvedItems.map((item) => item.id), ["2"]);
    component.handleInput("\x1b[27u");
    assert.deepEqual(result, { confirmed: false, approvedItems: [] });
  });

  it("falls back from unsupported RPC custom UI to confirm for approval and rejection", async () => {
    for (const confirmed of [true, false]) {
      let shown = false;
      const result = await presentMemoryProposal(items, { ui: {
        custom: async () => undefined,
        confirm: async (_title, prompt) => {
          shown = true;
          assert.ok(prompt.includes(items[0].fact));
          return confirmed;
        },
      } });
      assert.equal(shown, true);
      assert.deepEqual(result, { confirmed, approvedItems: confirmed ? items : [] });
    }
  });

  it("does not reopen confirmation after explicit cancellation in custom UI", async () => {
    const result = await presentMemoryProposal(items, { ui: {
      custom: async <T>() => ({ confirmed: false, approvedItems: [] }) as T,
      confirm: async () => { assert.fail("Cancellation must not fall back"); },
    } });
    assert.deepEqual(result, { confirmed: false, approvedItems: [] });
  });

  it("does not approve when custom UI is unsupported and no confirmation UI exists", async () => {
    assert.deepEqual(await presentMemoryProposal(items, { ui: { custom: async () => undefined } }),
      { confirmed: false, approvedItems: [] });
  });
});
