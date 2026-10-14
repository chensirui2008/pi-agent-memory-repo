import { buildMemoryContext } from "./core/context.js";
export { buildMemoryContext } from "./core/context.js";
import { handleInitCommand } from "./commands/init.js";
import { handleRememberCommand } from "./commands/remember.js";
import { handleDreamingCommand } from "./commands/dreaming.js";
import { handleStatusCommand } from "./commands/status.js";
import { memoryRecallTool } from "./tools/recall.js";
import { memoryWriteTool } from "./tools/write.js";
import { memoryReadTool } from "./tools/read.js";
import { memoryListTool } from "./tools/list.js";
// Re-export core modules for library usage
export * from "./config.js";
export * from "./core/types.js";
export * from "./core/schema.js";
export * from "./core/parser.js";
export * from "./core/git.js";
export * from "./core/repo.js";
export * from "./core/search.js";
export * from "./core/dreaming.js";
export * from "./tools/recall.js";
export * from "./tools/write.js";
export * from "./tools/read.js";
export * from "./tools/list.js";
export * from "./commands/init.js";
export * from "./commands/remember.js";
export * from "./commands/dreaming.js";
export * from "./commands/status.js";
/**
 * Registers a slash command accommodating multiple Pi API signatures:
 * 1. registerCommand(name, { description, handler })
 * 2. registerCommand({ name, description, handler })
 * 3. registerCommand(name, handler)
 */
function safeRegisterCommand(pi, name, description, handler) {
    if (typeof pi.registerCommand !== "function")
        return;
    try {
        pi.registerCommand(name, { description, handler });
    }
    catch {
        try {
            pi.registerCommand({ name, description, handler });
        }
        catch {
            try {
                pi.registerCommand(name, handler);
            }
            catch (err) {
                console.error(`[pi-agent-memory-repo] Error registering /${name}:`, err);
            }
        }
    }
}
/**
 * Pi Package Extension Entrypoint
 */
export default function (pi) {
    // 1. Register Core Agent Tools
    if (typeof pi.registerTool === "function") {
        pi.registerTool(memoryRecallTool);
        pi.registerTool(memoryWriteTool);
        pi.registerTool(memoryReadTool);
        pi.registerTool(memoryListTool);
    }
    // 2. Register Interactive Slash Commands
    safeRegisterCommand(pi, "init", "Initialize agent memory repository (/init memory [global|project|all])", handleInitCommand);
    safeRegisterCommand(pi, "init-memory", "Initialize agent memory repository", handleInitCommand);
    safeRegisterCommand(pi, "remember", "Summarize current turn learnings or save explicit fact to durable memory", handleRememberCommand);
    safeRegisterCommand(pi, "dreaming", "Consolidate memories, detect cross-session patterns, and synthesize new insights", handleDreamingCommand);
    safeRegisterCommand(pi, "status", "Display persistent memory status, Git commits, entry count, and link health", handleStatusCommand);
    safeRegisterCommand(pi, "memory-status", "Display persistent memory status", handleStatusCommand);
    // 3. Register Context Injection Lifecycle Hooks
    if (typeof pi.on === "function") {
        const injectHandler = async (ctxOrSession, ctx) => {
            try {
                const workspaceDir = ctx?.cwd || ctx?.workspaceDir || ctxOrSession?.workspaceDir || ctxOrSession?.cwd || process.cwd();
                const memoryContext = buildMemoryContext(workspaceDir);
                if (!memoryContext)
                    return;
                if (typeof ctxOrSession?.inject === "function") {
                    ctxOrSession.inject(memoryContext);
                }
                else if (Array.isArray(ctxOrSession?.messages)) {
                    return {
                        messages: [
                            {
                                role: "custom",
                                customType: "agent-memory",
                                content: memoryContext,
                                display: false,
                                timestamp: Date.now(),
                            },
                            ...ctxOrSession.messages.filter((message) => message.role !== "custom" || message.customType !== "agent-memory"),
                        ],
                    };
                }
                else if (typeof ctxOrSession?.systemPrompt === "string") {
                    ctxOrSession.systemPrompt += `\n\n${memoryContext}`;
                }
            }
            catch (err) {
                // Non-blocking fallback
            }
        };
        pi.on("context", injectHandler);
        pi.on("session_start", injectHandler);
    }
}
//# sourceMappingURL=index.js.map