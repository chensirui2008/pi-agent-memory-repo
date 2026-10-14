/**
 * Heuristically infers the most relevant topic file for a memory fact.
 */
export function inferTopicFile(fact) {
    const lower = fact.toLowerCase();
    if (lower.includes("prefer") ||
        lower.includes("tone") ||
        lower.includes("language") ||
        lower.includes("style") ||
        lower.includes("偏好") ||
        lower.includes("习惯") ||
        lower.includes("语气") ||
        lower.includes("风格") ||
        lower.includes("喜欢")) {
        return "topics/user_preferences.md";
    }
    if (lower.includes("test") ||
        lower.includes("spec") ||
        lower.includes("coverage") ||
        lower.includes("mock") ||
        lower.includes("vitest") ||
        lower.includes("jest") ||
        lower.includes("node:test") ||
        lower.includes("测试") ||
        lower.includes("断言")) {
        return "topics/testing_rules.md";
    }
    if (lower.includes("architecture") ||
        lower.includes("structure") ||
        lower.includes("pattern") ||
        lower.includes("design") ||
        lower.includes("invariant") ||
        lower.includes("convention") ||
        lower.includes("架构") ||
        lower.includes("设计") ||
        lower.includes("模块") ||
        lower.includes("规范")) {
        return "topics/architecture.md";
    }
    if (lower.includes("build") ||
        lower.includes("ci") ||
        lower.includes("deploy") ||
        lower.includes("docker") ||
        lower.includes("pnpm") ||
        lower.includes("npm") ||
        lower.includes("bundle") ||
        lower.includes("compile") ||
        lower.includes("构建") ||
        lower.includes("部署") ||
        lower.includes("打包") ||
        lower.includes("流水线")) {
        return "topics/build_and_deploy.md";
    }
    return "topics/session_notes.md";
}
/**
 * Infers target memory scope based on explicit override or target topic file.
 */
export function inferScope(fact, file, explicitScope) {
    if (explicitScope)
        return explicitScope;
    if (file === "topics/user_preferences.md" || fact.toLowerCase().includes("偏好") || fact.toLowerCase().includes("prefer")) {
        return "global";
    }
    return "project";
}
/**
 * Formats proposal items as a formatted readable string for confirm dialogs.
 */
export function formatProposalForConfirm(items) {
    const lines = [
        "Distilled key points from conversation:",
        "",
    ];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        lines.push(`${i + 1}. [${item.scope}] \`${item.file}\``);
        lines.push(`   • ${item.fact}`);
    }
    lines.push("", "Save these memories to durable Git-backed memory repository?");
    return lines.join("\n");
}
/**
 * Extracts plain text from a session message object or block array.
 */
export function extractMessageText(msg) {
    if (!msg)
        return "";
    if (typeof msg.content === "string")
        return msg.content;
    if (Array.isArray(msg.content)) {
        return msg.content
            .map((c) => {
            if (typeof c === "string")
                return c;
            if (c?.type === "text" && typeof c.text === "string")
                return c.text;
            if (typeof c?.text === "string")
                return c.text;
            return "";
        })
            .filter(Boolean)
            .join("\n");
    }
    if (typeof msg.text === "string")
        return msg.text;
    return "";
}
/**
 * Extracts all conversation messages from the active session context.
 */
export function getConversationMessages(ctx) {
    if (ctx.sessionManager && typeof ctx.sessionManager.getBranch === "function") {
        const branch = ctx.sessionManager.getBranch();
        return branch
            .filter((entry) => entry.type === "message" && entry.message)
            .map((entry) => entry.message);
    }
    if (ctx.session) {
        if (Array.isArray(ctx.session.messages)) {
            return ctx.session.messages;
        }
        if (Array.isArray(ctx.session)) {
            return ctx.session;
        }
    }
    if (Array.isArray(ctx.messages)) {
        return ctx.messages;
    }
    return [];
}
/**
 * Builds formatted conversation dialogue transcript for model summarization.
 */
export function buildConversationText(messages) {
    const sections = [];
    for (const msg of messages) {
        const text = extractMessageText(msg).trim();
        if (!text)
            continue;
        const role = (msg.role || "turn").toUpperCase();
        sections.push(`${role}: ${text}`);
    }
    return sections.join("\n\n");
}
/**
 * Calls the active model registry to synthesize structured memories from conversation.
 */
export async function summarizeWithModel(ctx, conversationText) {
    if (!ctx.model || !ctx.modelRegistry || typeof ctx.modelRegistry.complete !== "function") {
        return null;
    }
    try {
        const prompt = buildDistillationPrompt(conversationText);
        const response = await ctx.modelRegistry.complete(ctx.model, {
            messages: [
                {
                    role: "user",
                    content: [{ type: "text", text: prompt }],
                    timestamp: Date.now(),
                },
            ],
        });
        const contentText = response?.content
            ?.filter((c) => c.type === "text")
            ?.map((c) => c.text)
            ?.join("\n") || "";
        return parseMemoryCandidates(contentText);
    }
    catch {
        // Non-blocking fallback to heuristics
    }
    return null;
}
/**
 * Extracts key candidate facts from a session object or message array (Backwards-compatible API).
 */
export function extractSessionTakeaways(sessionOrMessages) {
    const candidates = [];
    if (!sessionOrMessages)
        return candidates;
    const messages = Array.isArray(sessionOrMessages.messages)
        ? sessionOrMessages.messages
        : Array.isArray(sessionOrMessages)
            ? sessionOrMessages
            : [];
    for (const msg of messages.slice(-15)) {
        const text = extractMessageText(msg);
        if (!text)
            continue;
        const lines = text.split(/\r?\n/);
        for (const l of lines) {
            const trimmed = l.trim().replace(/^[-*+]\s+/, "");
            if ((trimmed.startsWith("Note:") ||
                trimmed.startsWith("Remember:") ||
                trimmed.startsWith("Key takeaway:") ||
                trimmed.startsWith("记住:") ||
                trimmed.startsWith("记住：") ||
                trimmed.startsWith("注意:") ||
                trimmed.startsWith("注意：") ||
                trimmed.startsWith("决定") ||
                trimmed.startsWith("约定") ||
                trimmed.includes("prefer") ||
                trimmed.includes("decided to") ||
                trimmed.includes("偏好") ||
                trimmed.includes("约定") ||
                trimmed.includes("决定")) &&
                trimmed.length < 250) {
                const clean = trimmed.replace(/^(Note:|Remember:|Key takeaway:|记住[:：]|注意[:：]|决定[:：]|约定[:：])\s*/i, "").trim();
                if (clean && !candidates.includes(clean)) {
                    candidates.push(clean);
                }
            }
        }
    }
    return candidates;
}
/**
 * Heuristically distills conversation takeaways into structured proposal items.
 */
export function distillHeuristicTakeaways(messages, explicitScope) {
    const items = [];
    const seen = new Set();
    const rawFacts = extractSessionTakeaways(messages);
    for (let i = 0; i < rawFacts.length; i++) {
        const fact = rawFacts[i];
        if (seen.has(fact))
            continue;
        seen.add(fact);
        const topicFile = inferTopicFile(fact);
        const scope = inferScope(fact, topicFile, explicitScope);
        items.push({
            id: String(items.length + 1),
            fact,
            scope,
            file: topicFile,
            selected: true,
        });
    }
    return items;
}
export function buildDistillationPrompt(conversationText) {
    return [
        "You are a memory distillation assistant for the Pi coding agent, adhering to the Cognition Agent Memory Repo standard.",
        "Analyze the conversation below and extract durable facts, user preferences, architecture decisions, and testing/build rules that should be remembered across sessions.",
        "Do NOT extract ephemeral chit-chat, temporary status, or generic greetings.",
        "",
        "For each memory, categorize into:",
        "- scope: 'global' (for user preferences, style, tone) or 'project' (for codebase architecture, tests, build)",
        "- file: 'topics/user_preferences.md', 'topics/architecture.md', 'topics/testing_rules.md', 'topics/build_and_deploy.md', or 'topics/session_notes.md'",
        "- fact: a single concise factual bullet statement (< 200 chars)",
        "",
        "Return ONLY a JSON array of objects with keys: 'fact', 'scope', 'file', 'reason'. Example:",
        '[{"fact": "User prefers strict TypeScript without any", "scope": "global", "file": "topics/user_preferences.md", "reason": "user preference"}]',
        "",
        "<conversation>",
        conversationText.slice(-8000),
        "</conversation>",
    ].join("\n");
}
export function parseMemoryCandidates(contentText) {
    const jsonMatch = contentText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
                .filter((p) => p && typeof p.fact === "string" && p.fact.trim())
                .map((p, idx) => {
                const fact = p.fact.trim().replace(/^[-*+]\s+/, "");
                const file = p.file || inferTopicFile(fact);
                const scope = p.scope === "global" ? "global" : inferScope(fact, file);
                return {
                    id: String(idx + 1),
                    fact,
                    scope,
                    file,
                    reason: p.reason,
                    selected: true,
                };
            });
        }
    }
    return null;
}
//# sourceMappingURL=proposals.js.map