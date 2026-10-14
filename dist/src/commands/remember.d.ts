export { inferTopicFile, inferScope, formatProposalForConfirm, extractMessageText, getConversationMessages, buildConversationText, summarizeWithModel, extractSessionTakeaways, distillHeuristicTakeaways } from "../core/proposals.js";
import { CommandContext, ProposedMemoryEntry, ProposalResult } from "../core/types.js";
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