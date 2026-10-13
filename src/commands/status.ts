import { resolveScopePaths } from "../config.js";
import { getStatus } from "../core/repo.js";
import { CommandContext } from "../core/types.js";

/**
 * Handler for `/status`
 */
export async function handleStatusCommand(args: string, ctx: CommandContext): Promise<void> {
  const mappings = resolveScopePaths("all", ctx.workspaceDir || ctx.cwd || process.cwd());
  const lines: string[] = ["📊 **Agent Memory Repository Status**", ""];

  for (const mapping of mappings) {
    const scopeLabel = mapping.scope === "global" ? "Universal Memory (Global)" : "Project Memory";
    const status = await getStatus(mapping.path, mapping.scope);

    lines.push(`### ${scopeLabel}`);
    lines.push(`- **Location:** \`${status.path}\``);
    lines.push(`- **Exists:** ${status.exists ? "Yes" : "No (run `/init memory` to initialize)"}`);

    if (status.exists) {
      lines.push(
        `- **Git Status:** ${status.isGit ? `Branch \`${status.branch}\` (${status.clean ? "Clean" : "Dirty"})` : "Not a Git repo"}`
      );
      lines.push(`- **Commit Count:** ${status.commitCount}`);
      if (status.lastCommit) {
        lines.push(
          `- **Last Commit:** \`${status.lastCommit.hash}\` - "${status.lastCommit.message}" (${status.lastCommit.date})`
        );
      }
      lines.push(`- **Indexed Files:** ${status.fileCount}`);
      lines.push(`- **Total Memory Entries:** ${status.entryCount}`);

      if (status.brokenLinks.length > 0) {
        lines.push(`- ⚠️ **Broken Wiki-Links:** ${status.brokenLinks.length}`);
        for (const bl of status.brokenLinks) {
          lines.push(`  - \`${bl.fromFile}\` -> \`${bl.link}\``);
        }
      } else {
        lines.push(`- **Wiki-Link Health:** All links valid ✅`);
      }
    }

    lines.push("");
  }

  const output = lines.join("\n");
  ctx.ui?.notify?.(output, "info");
  ctx.ui?.log?.(output);
}
