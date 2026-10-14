import { getGlobalMemoryDir, getProjectMemoryDir } from "../config.js";
import { writeEntry } from "../core/repo.js";
import { buildConversationText, buildDistillationPrompt, distillHeuristicTakeaways, formatProposalForConfirm, getConversationMessages, inferScope, inferTopicFile, } from "../core/proposals.js";
const topicFiles = new Set([
    "topics/user_preferences.md", "topics/architecture.md", "topics/testing_rules.md",
    "topics/build_and_deploy.md", "topics/session_notes.md",
]);
/** Invalid output is a failed extraction; a valid empty array is an empty proposal. */
export function parseOmpCandidates(text) {
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, "$1"));
    if (!Array.isArray(parsed))
        throw new Error("Expected a JSON array");
    return parsed.map((item, index) => {
        if (!item || typeof item !== "object")
            throw new Error("Invalid memory candidate");
        const { fact, scope, file, reason } = item;
        if (typeof fact !== "string" || !fact.trim() || /[\r\n]/.test(fact) ||
            (scope !== "global" && scope !== "project") || typeof file !== "string" || !topicFiles.has(file)) {
            throw new Error("Invalid memory candidate");
        }
        return { id: String(index + 1), fact: fact.trim(), scope, file,
            reason: typeof reason === "string" ? reason : undefined, selected: true };
    });
}
export async function distillOmpMemories(ctx, messages, timeoutMs = 20_000) {
    const conversation = buildConversationText(messages);
    if (!conversation)
        return { items: [] };
    const controller = new AbortController();
    let timer;
    try {
        if (!ctx.model || !ctx.runEphemeralTurn)
            throw new Error("Current model unavailable");
        const timeout = new Promise((_resolve, reject) => {
            timer = setTimeout(() => {
                controller.abort();
                reject(new Error("Memory extraction timed out"));
            }, timeoutMs);
        });
        const result = await Promise.race([
            ctx.runEphemeralTurn({ promptText: buildDistillationPrompt(conversation), tools: false, signal: controller.signal }),
            timeout,
        ]);
        return { items: parseOmpCandidates(result.replyText) };
    }
    catch (error) {
        return { items: distillHeuristicTakeaways(messages),
            fallback: `Model extraction unavailable (${error instanceof Error ? error.message : String(error)}); using heuristic extraction.` };
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
/** Native selectors keep full facts visible and allow toggling individual entries. */
export async function selectOmpMemories(items, ctx) {
    if (ctx.mode === "tui" && ctx.ui?.select) {
        const selected = new Set(items.map((_, index) => index));
        const save = "Save selected memories";
        const cancel = "Cancel";
        while (true) {
            const labels = items.map((item, index) => `${index + 1}. [${item.scope}] ${item.file}: ${item.fact}`);
            const choice = await ctx.ui.select("Memory Proposal — select an entry to toggle", [...labels, save, cancel], {
                selectionMarker: "checkbox", checkedIndices: [...selected], markableCount: items.length,
                helpText: "Choose an entry to toggle; choose Save selected memories to finish.",
            });
            if (choice === undefined || choice === cancel)
                return [];
            if (choice === save)
                return items.filter((_, index) => selected.has(index));
            const index = labels.indexOf(choice);
            if (index < 0)
                return [];
            if (selected.has(index))
                selected.delete(index);
            else
                selected.add(index);
        }
    }
    if (ctx.ui?.confirm) {
        return await ctx.ui.confirm("Memory Proposal", formatProposalForConfirm(items)) ? items : [];
    }
    return [];
}
export async function handleOmpRememberCommand(args, ctx) {
    let note = args.trim();
    let explicitScope;
    const match = note.match(/^(?:--|\[)?(global|project)\]?(?:\s+([\s\S]*))?$/i);
    if (match) {
        explicitScope = match[1].toLowerCase();
        note = (match[2] || "").trim();
    }
    let items;
    if (note) {
        items = note.split(/\r?\n/).map(line => line.trim().replace(/^[-*+]\s+/, "")).filter(Boolean)
            .map((fact, index) => {
            const file = inferTopicFile(fact);
            return { id: String(index + 1), fact, file, scope: inferScope(fact, file, explicitScope), selected: true };
        });
    }
    else {
        const result = await distillOmpMemories(ctx, getConversationMessages(ctx));
        if (result.fallback)
            ctx.ui?.notify?.(result.fallback, "warning");
        items = result.items.map(item => ({ ...item, scope: explicitScope || item.scope }));
    }
    if (!items.length) {
        ctx.ui?.notify?.("No durable memories proposed. Nothing was written.", "info");
        return;
    }
    // The host reports actual UI availability, including RPC and --no-ui.
    const interactive = ctx.hasUI === true;
    if (!interactive && !note) {
        ctx.ui?.notify?.(`Memory proposal (review only; nothing was written):\n${formatProposalForConfirm(items)}`, "info");
        return;
    }
    const approved = interactive ? await selectOmpMemories(items, ctx) : items;
    if (!approved.length) {
        ctx.ui?.notify?.("Memory proposal discarded. Nothing was written.", "info");
        return;
    }
    for (const item of approved) {
        const repo = item.scope === "global" ? getGlobalMemoryDir() : getProjectMemoryDir(ctx.cwd || ctx.workspaceDir);
        try {
            const result = await writeEntry(repo, item.fact, { file: item.file, scope: item.scope,
                metadata: { source: "user_remember" }, commitMessage: `remember: ${item.fact.slice(0, 50)}` });
            ctx.ui?.notify?.(result.committed
                ? `Saved [${item.scope}] ${item.file}: ${result.entry.raw}${result.hash ? ` (commit ${result.hash})` : ""}`
                : `File written [${item.scope}] ${item.file}, but Git commit incomplete: ${result.commitError || "unknown error"}`, result.committed ? "info" : "warning");
        }
        catch (error) {
            ctx.ui?.notify?.(`Error saving memory: ${error instanceof Error ? error.message : String(error)}`, "error");
            return;
        }
    }
}
//# sourceMappingURL=omp-remember.js.map