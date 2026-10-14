import { OmpCommandContext } from "./commands/omp-remember.js";
import { CommandOptions, ToolDefinition } from "./core/types.js";
/** Structural host contract avoids a runtime dependency on either host's TUI. */
export interface OmpExtensionAPI {
    registerTool(tool: ToolDefinition & {
        approval: "read" | "write";
    }): void;
    registerCommand(name: string, options: CommandOptions): void;
    on(event: string, handler: (event: any, ctx: OmpCommandContext) => unknown): void;
    sendMessage(message: {
        customType: string;
        content: string;
        display: boolean;
    }, options: {
        triggerTurn: boolean;
    }): void;
}
export default function registerOmpMemory(omp: OmpExtensionAPI): void;
//# sourceMappingURL=omp.d.ts.map