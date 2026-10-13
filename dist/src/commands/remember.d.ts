import { CommandContext } from "../core/types.js";
/**
 * Heuristically infers the most relevant topic file for a memory fact.
 */
export declare function inferTopicFile(fact: string): string;
/**
 * Extracts key candidate facts from a session object or message array.
 */
export declare function extractSessionTakeaways(session: any): string[];
/**
 * Handler for `/remember [notes]`
 */
export declare function handleRememberCommand(args: string, ctx: CommandContext): Promise<void>;
//# sourceMappingURL=remember.d.ts.map