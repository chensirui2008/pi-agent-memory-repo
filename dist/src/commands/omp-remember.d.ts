import { CommandContext, ProposedMemoryEntry } from "../core/types.js";
export interface OmpCommandContext extends CommandContext {
    runEphemeralTurn?: (options: {
        promptText: string;
        tools: false;
        signal: AbortSignal;
    }) => Promise<{
        replyText: string;
    }>;
}
/** Invalid output is a failed extraction; a valid empty array is an empty proposal. */
export declare function parseOmpCandidates(text: string): ProposedMemoryEntry[];
export declare function distillOmpMemories(ctx: OmpCommandContext, messages: any[], timeoutMs?: number): Promise<{
    items: ProposedMemoryEntry[];
    fallback?: string;
}>;
/** Native selectors keep full facts visible and allow toggling individual entries. */
export declare function selectOmpMemories(items: ProposedMemoryEntry[], ctx: OmpCommandContext): Promise<ProposedMemoryEntry[]>;
export declare function handleOmpRememberCommand(args: string, ctx: OmpCommandContext): Promise<void>;
//# sourceMappingURL=omp-remember.d.ts.map