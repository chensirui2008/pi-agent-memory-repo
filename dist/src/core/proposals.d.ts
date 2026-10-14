import { CommandContext, MemoryScope, ProposedMemoryEntry } from "./types.js";
/**
 * Heuristically infers the most relevant topic file for a memory fact.
 */
export declare function inferTopicFile(fact: string): string;
/**
 * Infers target memory scope based on explicit override or target topic file.
 */
export declare function inferScope(fact: string, file: string, explicitScope?: MemoryScope | null): MemoryScope;
/**
 * Formats proposal items as a formatted readable string for confirm dialogs.
 */
export declare function formatProposalForConfirm(items: ProposedMemoryEntry[]): string;
/**
 * Extracts plain text from a session message object or block array.
 */
export declare function extractMessageText(msg: any): string;
/**
 * Extracts all conversation messages from the active session context.
 */
export declare function getConversationMessages(ctx: CommandContext): any[];
/**
 * Builds formatted conversation dialogue transcript for model summarization.
 */
export declare function buildConversationText(messages: any[]): string;
/**
 * Calls the active model registry to synthesize structured memories from conversation.
 */
export declare function summarizeWithModel(ctx: CommandContext, conversationText: string): Promise<ProposedMemoryEntry[] | null>;
/**
 * Extracts key candidate facts from a session object or message array (Backwards-compatible API).
 */
export declare function extractSessionTakeaways(sessionOrMessages: any): string[];
/**
 * Heuristically distills conversation takeaways into structured proposal items.
 */
export declare function distillHeuristicTakeaways(messages: any[], explicitScope?: MemoryScope | null): ProposedMemoryEntry[];
export declare function buildDistillationPrompt(conversationText: string): string;
export declare function parseMemoryCandidates(contentText: string): ProposedMemoryEntry[] | null;
//# sourceMappingURL=proposals.d.ts.map