import { buildMemoryContext } from "./core/context.js";
import { handleInitCommand } from "./commands/init.js";
import { handleStatusCommand } from "./commands/status.js";
import { handleDreamingCommand } from "./commands/dreaming.js";
import { handleOmpRememberCommand, OmpCommandContext } from "./commands/omp-remember.js";
import { memoryRecallTool } from "./tools/recall.js";
import { memoryReadTool } from "./tools/read.js";
import { memoryListTool } from "./tools/list.js";
import { memoryWriteTool } from "./tools/write.js";
import { CommandOptions, ToolDefinition } from "./core/types.js";

/** Structural host contract avoids a runtime dependency on either host's TUI. */
export interface OmpExtensionAPI {
  registerTool(tool: ToolDefinition & { approval: "read" | "write" }): void;
  registerCommand(name: string, options: CommandOptions): void;
  on(event: string, handler: (event: any, ctx: OmpCommandContext) => unknown): void;
  sendMessage(message: { customType: string; content: string; display: boolean }, options: { triggerTurn: boolean }): void;
}

const snapshotPrefix = '<agent_memory source="pi-agent-memory-repo">';

export default function registerOmpMemory(omp: OmpExtensionAPI): void {
  for (const tool of [memoryRecallTool, memoryReadTool, memoryListTool, memoryWriteTool]) {
    omp.registerTool({ ...tool, approval: tool.name === "memory_write" ? "write" : "read" });
  }
  const commands = [
    ["init-memory", "Initialize memory repositories", handleInitCommand],
    ["memory-status", "Display memory paths, entries, links and Git status", handleStatusCommand],
    ["remember", "Save explicit notes or propose durable session memories", handleOmpRememberCommand],
    ["dreaming", "Consolidate memory repositories", handleDreamingCommand],
  ] as const;
  for (const [name, description, handler] of commands) {
    omp.registerCommand(name, { description, handler: async (args, ctx) => {
      const adapted: OmpCommandContext = { ...ctx, ui: { ...ctx.ui,
        log: undefined,
        notify: (content, type) => {
          if (ctx.mode === "tui" || ctx.hasUI) ctx.ui?.notify?.(content, type === "success" ? "info" : type);
          else omp.sendMessage({ customType: "agent-memory-result", content, display: true }, { triggerTurn: false });
        },
      } };
      await handler(args, adapted);
    } });
  }

  let snapshot = "";
  const loadSnapshot = (_event: unknown, ctx: OmpCommandContext) => {
    snapshot = buildMemoryContext(ctx.cwd || ctx.workspaceDir, error => {
      const message = `Memory snapshot could not be read: ${error.message}`;
      ctx.ui?.notify?.(message, "warning");
      console.error(`[pi-agent-memory-repo] ${message}`);
    }).replace("<agent_memory>", snapshotPrefix);
  };
  omp.on("session_start", loadSnapshot);
  omp.on("session_switch", loadSnapshot);
  omp.on("before_agent_start", (event: { systemPrompt: string[] }) => {
    const prompts = event.systemPrompt.filter(prompt => !prompt.startsWith(snapshotPrefix));
    return { systemPrompt: snapshot ? [...prompts, snapshot] : prompts };
  });
}
