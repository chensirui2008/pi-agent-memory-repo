import * as fs from "node:fs";
import * as path from "node:path";
import { getGlobalMemoryDir, getProjectMemoryDir } from "../config.js";

/**
 * Generates compact memory context to inject into LLM session turns.
 */
export function buildMemoryContext(workspaceDir?: string, onError?: (error: Error) => void): string {
  const globalDir = getGlobalMemoryDir();
  const projectDir = getProjectMemoryDir(workspaceDir);

  const globalMemoryPath = path.join(globalDir, "MEMORY.md");
  const projectMemoryPath = path.join(projectDir, "MEMORY.md");

  const read = (file: string): string | null => {
    try {
      return fs.readFileSync(file, "utf8").trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        if (!onError) throw error;
        onError(error instanceof Error ? error : new Error(String(error)));
      }
      return null;
    }
  };
  const globalContent = read(globalMemoryPath);
  const projectContent = projectMemoryPath !== globalMemoryPath ? read(projectMemoryPath) : null;

  if (!globalContent && !projectContent) {
    return "";
  }

  const sections: string[] = [
    "<agent_memory>",
    "Persistent cross-session long-term memory (Cognition Agent Memory Repo standard).",
    "Navigate deeper topics via [[topics/...]] using memory_read or memory_recall.",
    "",
  ];

  if (globalContent) {
    sections.push("## Universal Memory (~/.pi/agent-memory/MEMORY.md)", globalContent, "");
  }

  if (projectContent) {
    sections.push("## Project Memory (.pi/memory/MEMORY.md)", projectContent, "");
  }

  sections.push("</agent_memory>");
  return sections.join("\n");
}

