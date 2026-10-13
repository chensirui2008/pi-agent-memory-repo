import { getProjectMemoryDir, getGlobalMemoryDir } from "../config.js";
import { writeEntry } from "../core/repo.js";
import { CommandContext } from "../core/types.js";

/**
 * Heuristically infers the most relevant topic file for a memory fact.
 */
export function inferTopicFile(fact: string): string {
  const lower = fact.toLowerCase();
  if (
    lower.includes("prefer") ||
    lower.includes("tone") ||
    lower.includes("language") ||
    lower.includes("style") ||
    lower.includes("偏好") ||
    lower.includes("习惯") ||
    lower.includes("语气")
  ) {
    return "topics/user_preferences.md";
  }
  if (
    lower.includes("test") ||
    lower.includes("spec") ||
    lower.includes("coverage") ||
    lower.includes("mock") ||
    lower.includes("vitest") ||
    lower.includes("jest") ||
    lower.includes("测试")
  ) {
    return "topics/testing_rules.md";
  }
  if (
    lower.includes("architecture") ||
    lower.includes("structure") ||
    lower.includes("pattern") ||
    lower.includes("design") ||
    lower.includes("架构") ||
    lower.includes("设计") ||
    lower.includes("模块")
  ) {
    return "topics/architecture.md";
  }
  if (
    lower.includes("build") ||
    lower.includes("ci") ||
    lower.includes("deploy") ||
    lower.includes("docker") ||
    lower.includes("构建") ||
    lower.includes("部署") ||
    lower.includes("打包")
  ) {
    return "topics/build_and_deploy.md";
  }
  return "topics/session_notes.md";
}

/**
 * Extracts key candidate facts from a session object or message array.
 */
export function extractSessionTakeaways(session: any): string[] {
  const candidates: string[] = [];
  if (!session) return candidates;

  const messages: any[] = Array.isArray(session.messages)
    ? session.messages
    : Array.isArray(session)
    ? session
    : [];

  for (const msg of messages.slice(-10)) {
    let text = "";
    if (typeof msg.content === "string") {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .map((c: any) => (typeof c === "string" ? c : c?.text || ""))
        .filter(Boolean)
        .join("\n");
    } else if (msg.text) {
      text = msg.text;
    }

    if (!text) continue;

    // Extract lines that look like decisions or learnings
    const lines = text.split("\n");
    for (const l of lines) {
      const trimmed = l.trim().replace(/^[-*+]\s+/, "");
      if (
        (trimmed.startsWith("Note:") ||
          trimmed.startsWith("Remember:") ||
          trimmed.startsWith("Key takeaway:") ||
          trimmed.startsWith("记住:") ||
          trimmed.startsWith("记住：") ||
          trimmed.startsWith("注意:") ||
          trimmed.startsWith("注意：") ||
          trimmed.includes("prefer") ||
          trimmed.includes("decided to") ||
          trimmed.includes("偏好") ||
          trimmed.includes("约定") ||
          trimmed.includes("决定")) &&
        trimmed.length < 250
      ) {
        const clean = trimmed.replace(/^(Note:|Remember:|Key takeaway:|记住[:：]|注意[:：])\s*/i, "");
        if (clean && !candidates.includes(clean)) {
          candidates.push(clean);
        }
      }
    }
  }

  return candidates;
}

/**
 * Handler for `/remember [notes]`
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

  if (trimmedArgs) {
    // If multi-line, extract distinct non-empty lines
    const rawLines = trimmedArgs.split(/\r?\n/).map((l) => l.trim().replace(/^[-*+]\s+/, "")).filter(Boolean);
    const factsToWrite = rawLines.length > 0 ? rawLines : [trimmedArgs];
    const recorded: string[] = [];

    for (const fact of factsToWrite) {
      const topicFile = inferTopicFile(fact);
      const targetScope: "global" | "project" = explicitScope || (topicFile === "topics/user_preferences.md" ? "global" : "project");
      const targetRepo = targetScope === "global" ? getGlobalMemoryDir() : getProjectMemoryDir(workspaceRoot);

      const { entry, hash } = await writeEntry(targetRepo, fact, {
        file: topicFile,
        scope: targetScope,
        metadata: { source: "user_remember" },
        commitMessage: `remember: ${fact.slice(0, 50)}`,
      });

      recorded.push(`- [${targetScope}] \`${topicFile}\`: ${entry.raw}${hash ? ` (${hash})` : ""}`);
    }

    const msg = `💾 Stored memory:\n${recorded.join("\n")}`;
    ctx.ui?.notify?.(msg, "success");
    ctx.ui?.log?.(msg);
    return;
  }

  // No arguments provided: summarize from recent session context
  const messages = ctx.sessionManager
    ? ctx.sessionManager.getBranch()
        .filter((entry) => entry.type === "message")
        .map((entry) => entry.message)
    : ctx.session;
  const takeaways = extractSessionTakeaways(messages);
  if (takeaways.length === 0) {
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

  const recorded: string[] = [];
  for (const takeaway of takeaways) {
    const topicFile = inferTopicFile(takeaway);
    const targetScope: "global" | "project" = explicitScope || (topicFile === "topics/user_preferences.md" ? "global" : "project");
    const targetRepo = targetScope === "global" ? getGlobalMemoryDir() : getProjectMemoryDir(workspaceRoot);

    const { entry } = await writeEntry(targetRepo, takeaway, {
      file: topicFile,
      scope: targetScope,
      metadata: { source: "session_dialogue" },
    });
    recorded.push(`- [${targetScope}] \`${topicFile}\`: ${entry.raw}`);
  }

  const summary = `💾 Summarized and stored ${takeaways.length} session learnings into memory:\n${recorded.join("\n")}`;
  ctx.ui?.notify?.(summary, "success");
  ctx.ui?.log?.(summary);
}
