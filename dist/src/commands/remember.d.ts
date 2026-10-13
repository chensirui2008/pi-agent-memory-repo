import { CommandContext, MemoryScope, ProposedMemoryEntry, ProposalResult } from "../core/types.js";
/**
 * Heuristically infers the most relevant topic file for a memory fact.
 */
export declare function inferTopicFile(fact: string): string;
/**
 * Infers target memory scope based on explicit override or target topic file.
 */
export declare function inferScope(fact: string, file: string, explicitScope?: MemoryScope | null): MemoryScope;
/**
 * Calculates visible terminal column width using Pi's grapheme-aware utilities.
 */
export declare function stringWidth(str: string): number;
/**
 * Fits and pads a string to the target terminal column width.
 */
export declare function padLine(text: string, innerWidth: number): string;
/**
 * Wraps text while preserving ANSI styling and grapheme boundaries.
 */
export declare function wrapText(text: string, maxWidth: number): string[];
/**
 * Creates an interactive TUI component for the proposal modal.
 */
export declare function createMemoryProposalComponent(items: ProposedMemoryEntry[], tui: any, theme: any, done: (result: ProposalResult) => void): {
    render: (width: number) => string[];
    invalidate: () => void;
    handleInput: (data: string) => void;
};
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
/**
 * Presents proposal to the user via TUI custom component, confirm dialog, or select menu,
 * and waits for user agreement before proceeding.
 */
export declare function presentMemoryProposal(proposalItems: ProposedMemoryEntry[], ctx: CommandContext): Promise<ProposalResult>;
/**
 * Handler for `/remember [notes]`
 * Summarizes the conversation, distills key points, presents a TUI proposal,
 * and writes to Git memory only after user agreement.
 */
export declare function handleRememberCommand(args: string, ctx: CommandContext): Promise<void>;
//# sourceMappingURL=remember.d.ts.map