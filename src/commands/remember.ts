import { inferTopicFile, inferScope, formatProposalForConfirm, getConversationMessages, buildConversationText, summarizeWithModel, extractSessionTakeaways, distillHeuristicTakeaways } from "../core/proposals.js";
export { inferTopicFile, inferScope, formatProposalForConfirm, extractMessageText, getConversationMessages, buildConversationText, summarizeWithModel, extractSessionTakeaways, distillHeuristicTakeaways } from "../core/proposals.js";
import { Key, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { getProjectMemoryDir, getGlobalMemoryDir } from "../config.js";
import { writeEntry } from "../core/repo.js";
import { CommandContext, MemoryScope, ProposedMemoryEntry, ProposalResult } from "../core/types.js";

/**
 * Calculates visible terminal column width using Pi's grapheme-aware utilities.
 */
export function stringWidth(str: string): number {
  return visibleWidth(str);
}

/**
 * Fits and pads a string to the target terminal column width.
 */
export function padLine(text: string, innerWidth: number): string {
  return truncateToWidth(text, Math.max(0, innerWidth), "", true);
}

/**
 * Wraps text while preserving ANSI styling and grapheme boundaries.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text.trim() || maxWidth <= 0) return [];
  return wrapTextWithAnsi(text, maxWidth).map((line) => truncateToWidth(line, maxWidth, ""));
}

/**
 * Creates an interactive TUI component for the proposal modal.
 */
export function createMemoryProposalComponent(
  items: ProposedMemoryEntry[],
  tui: any,
  theme: any,
  done: (result: ProposalResult) => void
) {
  let focusedIndex = 0;
  const currentItems = items.map((it) => ({ ...it }));

  function render(width: number): string[] {
    const termWidth = Math.max(0, Math.min(Math.floor(width), 100));
    if (termWidth < 5) return [];
    const innerWidth = termWidth - 4; // 2 border characters + 2 padding spaces
    const lines: string[] = [];

    const cyan = (s: string) => (theme?.fg ? theme.fg("accent", s) : `\x1b[36m${s}\x1b[39m`);
    const green = (s: string) => (theme?.fg ? theme.fg("success", s) : `\x1b[32m${s}\x1b[39m`);
    const yellow = (s: string) => (theme?.fg ? theme.fg("warning", s) : `\x1b[33m${s}\x1b[39m`);
    const dim = (s: string) => (theme?.fg ? theme.fg("dim", s) : `\x1b[90m${s}\x1b[39m`);
    const bold = (s: string) => (theme?.bold ? theme.bold(s) : `\x1b[1m${s}\x1b[22m`);

    function addRow(text: string): void {
      for (const line of wrapText(text, innerWidth)) {
        lines.push(cyan("│ ") + padLine(line, innerWidth) + cyan(" │"));
      }
    }

    // Top border
    lines.push(cyan("┌" + "─".repeat(termWidth - 2) + "┐"));

    // Header title
    const title = " 🧠 Memory Proposal (/remember)";
    addRow(bold(title));

    const subtitle = " Review conversation insights before saving to Git memory:";
    addRow(dim(subtitle));

    lines.push(cyan("├" + "─".repeat(termWidth - 2) + "┤"));

    // Items list
    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      const isFocused = i === focusedIndex;
      const checkbox = item.selected ? green("[✓]") : dim("[ ]");
      const cursor = isFocused ? cyan("▶ ") : "  ";
      const scopeBadge = item.scope === "global" ? yellow("[global]") : cyan("[project]");

      const headerLine = `${cursor}${checkbox} ${scopeBadge} ${item.file}`;
      addRow(headerLine);

      const factLine = `    • ${item.fact}`;
      const wrapped = wrapText(factLine, innerWidth);
      for (const wl of wrapped) {
        lines.push(cyan("│ ") + padLine(isFocused ? bold(wl) : wl, innerWidth) + cyan(" │"));
      }

      if (i < currentItems.length - 1) {
        lines.push(cyan("│ ") + " ".repeat(innerWidth) + cyan(" │"));
      }
    }

    lines.push(cyan("├" + "─".repeat(termWidth - 2) + "┤"));

    // Status
    const selectedCount = currentItems.filter((it) => it.selected).length;
    const statsText = ` Selected: ${selectedCount} of ${currentItems.length} memories`;
    addRow(green(statsText));

    // Controls
    const controls = " [↑/↓] Navigate  [Space] Toggle  [a] All  [Enter/y] Save  [Esc/n] Cancel";
    addRow(dim(controls));

    // Bottom border
    lines.push(cyan("└" + "─".repeat(termWidth - 2) + "┘"));

    return lines;
  }

  function handleInput(data: string): void {
    if (matchesKey(data, Key.up) || matchesKey(data, "k") || matchesKey(data, Key.shift("k"))) {
      focusedIndex = Math.max(0, focusedIndex - 1);
      tui?.requestRender?.();
      return;
    }
    if (matchesKey(data, Key.down) || matchesKey(data, "j") || matchesKey(data, Key.shift("j"))) {
      focusedIndex = Math.min(currentItems.length - 1, focusedIndex + 1);
      tui?.requestRender?.();
      return;
    }
    if (matchesKey(data, Key.space)) {
      if (currentItems[focusedIndex]) {
        currentItems[focusedIndex].selected = !currentItems[focusedIndex].selected;
      }
      tui?.requestRender?.();
      return;
    }
    if (matchesKey(data, "a") || matchesKey(data, Key.shift("a"))) {
      const allSelected = currentItems.every((it) => it.selected);
      for (const it of currentItems) {
        it.selected = !allSelected;
      }
      tui?.requestRender?.();
      return;
    }
    if (matchesKey(data, Key.enter) || data === "\n" || matchesKey(data, "y") || matchesKey(data, Key.shift("y"))) {
      const approved = currentItems.filter((it) => it.selected);
      done({ confirmed: approved.length > 0, approvedItems: approved });
      return;
    }
    if (matchesKey(data, Key.escape) || matchesKey(data, "n") || matchesKey(data, Key.shift("n")) || matchesKey(data, "q") || matchesKey(data, Key.shift("q"))) {
      done({ confirmed: false, approvedItems: [] });
      return;
    }
  }

  return {
    render,
    invalidate: () => {},
    handleInput,
  };
}

/**
 * Presents proposal to the user via TUI custom component, confirm dialog, or select menu,
 * and waits for user agreement before proceeding.
 */
export async function presentMemoryProposal(
  proposalItems: ProposedMemoryEntry[],
  ctx: CommandContext
): Promise<ProposalResult> {
  // 1. Full interactive Terminal UI modal component (Primary TUI path)
  if (typeof ctx.ui?.custom === "function") {
    const res = await ctx.ui.custom<ProposalResult>(
      (tui: any, theme: any, _kb: any, done: (res: ProposalResult) => void) => {
        return createMemoryProposalComponent(proposalItems, tui, theme, done);
      }
    );
    // RPC exposes custom(), but returns undefined without invoking the factory.
    if (res !== undefined) return res;
  }

  // 2. Interactive confirmation dialog
  if (typeof ctx.ui?.confirm === "function") {
    const promptText = formatProposalForConfirm(proposalItems);
    const confirmed = await ctx.ui.confirm("🧠 Memory Proposal", promptText);
    return {
      confirmed: !!confirmed,
      approvedItems: confirmed ? proposalItems : [],
    };
  }

  // 3. Interactive selection menu
  if (typeof ctx.ui?.select === "function") {
    const choice = await ctx.ui.select("🧠 Memory Proposal: Distilled conversation insights", [
      `✅ Approve & Save all memories (${proposalItems.length} items)`,
      "❌ Cancel and discard proposal",
    ]);
    const confirmed = choice?.startsWith("✅") ?? false;
    return {
      confirmed,
      approvedItems: confirmed ? proposalItems : [],
    };
  }

  // 4. Preserve the headless fallback, but never approve an unsupported custom UI.
  return {
    confirmed: typeof ctx.ui?.custom !== "function",
    approvedItems: typeof ctx.ui?.custom === "function" ? [] : proposalItems,
  };
}

/**
 * Handler for `/remember [notes]`
 * Summarizes the conversation, distills key points, presents a TUI proposal,
 * and writes to Git memory only after user agreement.
 */
export async function handleRememberCommand(args: string, ctx: CommandContext): Promise<void> {
  let trimmedArgs = args.trim();
  let explicitScope: "global" | "project" | null = null;

  // Check for scope prefix e.g. "/remember global ..." or "/remember project ..." or "/remember --global ..."
  const scopePrefixMatch = trimmedArgs.match(/^(--|\[)?(global|project)\]?\s+(.*)$/i);
  if (scopePrefixMatch) {
    explicitScope = scopePrefixMatch[2].toLowerCase() as "global" | "project";
    trimmedArgs = scopePrefixMatch[3].trim();
  }

  const workspaceRoot = ctx.workspaceDir || ctx.cwd || process.cwd();
  const candidates: ProposedMemoryEntry[] = [];

  // 1. Process explicit argument if provided
  if (trimmedArgs) {
    const rawLines = trimmedArgs.split(/\r?\n/).map((l) => l.trim().replace(/^[-*+]\s+/, "")).filter(Boolean);
    const facts = rawLines.length > 0 ? rawLines : [trimmedArgs];

    for (const fact of facts) {
      const topicFile = inferTopicFile(fact);
      const scope = inferScope(fact, topicFile, explicitScope);
      candidates.push({
        id: String(candidates.length + 1),
        fact,
        scope,
        file: topicFile,
        selected: true,
      });
    }
  }

  // 2. Extract conversation messages and distill key takeaways
  const messages = getConversationMessages(ctx);
  const conversationText = buildConversationText(messages);

  if (conversationText) {
    // Try model summarization first if model runtime is configured
    const modelCandidates = await summarizeWithModel(ctx, conversationText);
    if (modelCandidates && modelCandidates.length > 0) {
      for (const mc of modelCandidates) {
        if (!candidates.some((c) => c.fact === mc.fact)) {
          candidates.push({
            ...mc,
            id: String(candidates.length + 1),
            scope: explicitScope || mc.scope,
          });
        }
      }
    } else {
      // Fallback to heuristic distillation
      const heuristicCandidates = distillHeuristicTakeaways(messages, explicitScope);
      for (const hc of heuristicCandidates) {
        if (!candidates.some((c) => c.fact === hc.fact)) {
          candidates.push({
            ...hc,
            id: String(candidates.length + 1),
          });
        }
      }
    }
  }

  // 3. If no candidate takeaways could be identified
  if (candidates.length === 0) {
    const defaultRepo = explicitScope === "global" ? getGlobalMemoryDir() : getProjectMemoryDir(workspaceRoot);
    const defaultScope = explicitScope || "project";
    const timestamp = new Date().toLocaleTimeString();
    const fallbackFact = `Session checkpoint recorded at ${timestamp}`;
    const { entry, hash } = await writeEntry(defaultRepo, fallbackFact, {
      file: "topics/session_notes.md",
      scope: defaultScope,
      metadata: { source: "session_summary" },
      commitMessage: `remember: session checkpoint at ${timestamp}`,
    });

    const msg = `💾 No explicit note supplied. Recorded session checkpoint in \`topics/session_notes.md\`${hash ? ` (commit ${hash})` : ""}:\n\`${entry.raw}\`\nTip: You can pass text directly, e.g. \`/remember prefers vitest\` or \`/remember global <fact>\`.`;
    ctx.ui?.notify?.(msg, "info");
    ctx.ui?.log?.(msg);
    return;
  }

  // 4. Present proposal in TUI to the user and wait for approval
  const result = await presentMemoryProposal(candidates, ctx);

  // 5. Handle user cancellation or rejection
  if (!result.confirmed || result.approvedItems.length === 0) {
    const cancelMsg = "❌ Memory proposal discarded. Nothing was written.";
    ctx.ui?.notify?.(cancelMsg, "info");
    ctx.ui?.log?.(cancelMsg);
    return;
  }

  // 6. User agreed: write approved entries into persistent Git memory repository
  const recorded: string[] = [];
  for (const item of result.approvedItems) {
    const targetRepo = item.scope === "global" ? getGlobalMemoryDir() : getProjectMemoryDir(workspaceRoot);

    const { entry, hash } = await writeEntry(targetRepo, item.fact, {
      file: item.file,
      scope: item.scope,
      metadata: { source: "user_remember" },
      commitMessage: `remember: ${item.fact.slice(0, 50)}`,
    });

    recorded.push(`- [${item.scope}] \`${item.file}\`: ${entry.raw}${hash ? ` (${hash})` : ""}`);
  }

  const summary = `💾 Summarized and stored ${result.approvedItems.length} session learnings into memory:\n${recorded.join("\n")}`;
  ctx.ui?.notify?.(summary, "success");
  ctx.ui?.log?.(summary);
}
