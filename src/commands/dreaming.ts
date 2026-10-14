import { resolveScopePaths } from "../config.js";
import { runDreaming } from "../core/dreaming.js";
import { CommandContext } from "../core/types.js";

/**
 * Handler for `/dreaming [global|project|all]`
 */
export async function handleDreamingCommand(args: string, ctx: CommandContext): Promise<void> {
  const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const scopeArg = (parts[0] && ["global", "project", "all"].includes(parts[0]) ? parts[0] : "all") as
    | "global"
    | "project"
    | "all";

  const mappings = resolveScopePaths(scopeArg, ctx.workspaceDir || ctx.cwd || process.cwd());
  const reportLines: string[] = ["🌙 **Agent Dreaming Consolidation Report**", ""];

  for (const mapping of mappings) {
    const scopeLabel = mapping.scope === "global" ? "Universal Memory" : "Project Memory";
    reportLines.push(`### Scope: ${scopeLabel} (\`${mapping.path}\`)`);

    try {
      const report = await runDreaming(mapping.path, mapping.scope);

      reportLines.push(
        `- **Synthesized Patterns:** ${report.patternsSynthesized}`,
        `- **Duplicates Merged:** ${report.duplicatesMerged}`,
        `- **Contradictions Resolved:** ${report.contradictionsResolved}`,
        `- **Files Modified:** ${report.filesModified.length > 0 ? report.filesModified.map((f) => `\`${f}\``).join(", ") : "None"}`
      );

      if (report.commitError) {
        reportLines.push(`⚠️ Files written, but Git commit incomplete: ${report.commitError}`);
      }

      if (report.commitHash) {
        reportLines.push(`- **Git Commit:** \`${report.commitHash}\``);
      }

      if (report.synthesizedEntries.length > 0) {
        reportLines.push("", "**Newly Synthesized Patterns:**");
        for (const se of report.synthesizedEntries) {
          reportLines.push(`  - \`${se}\``);
        }
      }

      if (report.mergedEntries.length > 0) {
        reportLines.push("", "**Consolidated Duplicates:**");
        for (const me of report.mergedEntries) {
          reportLines.push(`  - ${me}`);
        }
      }
    } catch (err: any) {
      reportLines.push(`❌ Dreaming error on ${scopeLabel}: ${err.message}`);
    }

    reportLines.push("");
  }

  const output = reportLines.join("\n");
  ctx.ui?.notify?.(output, "info");
  ctx.ui?.log?.(output);
}
