import * as fs from "node:fs";
import * as path from "node:path";
import {
  MemoryEntry,
  MemoryFile,
  MemoryMetadata,
  MemoryRepoStatus,
  MemoryScope,
} from "./types.js";
import {
  formatEntry,
  parseMemoryFile,
  resolveWikiLink,
  extractWikiLinks,
} from "./parser.js";
import {
  gitCommit,
  gitCommitCount,
  gitInit,
  gitLog,
  gitStatus,
  isGitRepo,
} from "./git.js";

/** Resolve a repo-relative path, rejecting traversal and symlink escapes. */
export function resolveMemoryPath(repoPath: string, relativePath: string): string {
  const root = path.resolve(repoPath);
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized || path.isAbsolute(normalized) || path.win32.isAbsolute(normalized) ||
      normalized.split("/").includes("..")) {
    throw new Error("Memory path must stay inside the repository");
  }
  const target = path.resolve(root, normalized);
  const inside = (base: string, candidate: string) => {
    const relative = path.relative(base, candidate);
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (!inside(root, target) || target === root) {
    throw new Error("Memory path must stay inside the repository");
  }
  if (fs.existsSync(root)) {
    const realRoot = fs.realpathSync(root);
    let current = root;
    for (const part of path.relative(root, target).split(path.sep)) {
      current = path.join(current, part);
      try {
        fs.lstatSync(current);
      } catch (error: any) {
        if (error.code === "ENOENT") break;
        throw error;
      }
      if (!inside(realRoot, fs.realpathSync(current))) {
        throw new Error("Memory path symlink escapes the repository");
      }
    }
  }
  return target;
}

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Initializes a Cognition-compliant memory repository with git.
 */
export async function initRepo(
  repoPath: string,
  scope: MemoryScope,
  customTitle?: string
): Promise<{ created: boolean; repoPath: string }> {
  const resolvedPath = path.resolve(repoPath);
  const existed = fs.existsSync(resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }

  const topicsDir = resolveMemoryPath(resolvedPath, "topics");
  if (!fs.existsSync(topicsDir)) {
    fs.mkdirSync(topicsDir, { recursive: true });
  }

  const memoryMdPath = resolveMemoryPath(resolvedPath, "MEMORY.md");
  const defaultTitle = customTitle || (scope === "global" ? "Universal Agent Memory" : "Project Memory");
  const today = getTodayDate();

  if (!fs.existsSync(memoryMdPath)) {
    const memoryTemplate = `# Agent Memory: ${defaultTitle}

- Memory repository initialized [source: init; added: ${today}]

## Index
- [[topics/notes]]
`;
    fs.writeFileSync(memoryMdPath, memoryTemplate, "utf8");
  }

  const notesMdPath = resolveMemoryPath(resolvedPath, "topics/notes.md");
  if (!fs.existsSync(notesMdPath)) {
    const notesTemplate = `# General Notes

- Initial topic notes initialized [source: init; added: ${today}]
`;
    fs.writeFileSync(notesMdPath, notesTemplate, "utf8");
  }

  // Initialize git if not already a repo
  if (!isGitRepo(resolvedPath)) {
    await gitInit(resolvedPath);
    await gitCommit(resolvedPath, "init: initialize agent memory repository");
  }

  return { created: !existed, repoPath: resolvedPath };
}

/**
 * Recursively lists all markdown and documentation files in the memory repository.
 */
export async function listMemoryFiles(repoPath: string): Promise<string[]> {
  const resolvedPath = path.resolve(repoPath);
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const results: string[] = [];

  function walk(currentDir: string, relativeDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".") || ent.name === "node_modules") {
        continue;
      }
      const relPath = relativeDir ? path.join(relativeDir, ent.name) : ent.name;
      const fullPath = path.join(currentDir, ent.name);

      if (ent.isDirectory()) {
        walk(fullPath, relPath);
      } else if (ent.isFile() && (ent.name.endsWith(".md") || ent.name.endsWith(".markdown") || ent.name.endsWith(".txt"))) {
        results.push(relPath);
      }
    }
  }

  walk(resolvedPath, "");
  return results.sort();
}

/**
 * Reads the content of a memory file.
 */
export async function readMemoryFile(
  repoPath: string,
  relativePath: string
): Promise<string | null> {
  const target = relativePath.endsWith(".md") || path.extname(relativePath)
    ? relativePath
    : `${relativePath}.md`;
  const fullPath = resolveMemoryPath(repoPath, target);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, "utf8");
}

/**
 * Scans all memory files, parses entries, and detects broken links.
 */
export async function scanRepo(
  repoPath: string,
  scope: MemoryScope
): Promise<{
  files: MemoryFile[];
  allEntries: MemoryEntry[];
  brokenLinks: Array<{ fromFile: string; link: string }>;
}> {
  const resolvedPath = path.resolve(repoPath);
  if (!fs.existsSync(resolvedPath)) {
    return { files: [], allEntries: [], brokenLinks: [] };
  }

  const relativeFiles = await listMemoryFiles(resolvedPath);
  const files: MemoryFile[] = [];
  const allEntries: MemoryEntry[] = [];
  const brokenLinks: Array<{ fromFile: string; link: string }> = [];

  for (const relFile of relativeFiles) {
    const content = fs.readFileSync(resolveMemoryPath(resolvedPath, relFile), "utf8");
    const memFile = parseMemoryFile(content, relFile, resolvedPath, scope);
    files.push(memFile);
    allEntries.push(...memFile.entries);

    // Check entry links
    for (const entry of memFile.entries) {
      for (const link of entry.links) {
        if (!link.exists) {
          brokenLinks.push({ fromFile: relFile, link: link.raw });
        }
      }
    }

    // Check index section links
    for (const indexLink of memFile.indexLinks) {
      if (!indexLink.exists) {
        brokenLinks.push({ fromFile: relFile, link: indexLink.raw });
      }
    }
  }

  return { files, allEntries, brokenLinks };
}

/**
 * Ensures a topic link exists in MEMORY.md ## Index section.
 */
export async function updateIndex(repoPath: string, topicFile: string): Promise<boolean> {
  const memoryMdPath = resolveMemoryPath(repoPath, "MEMORY.md");
  if (!fs.existsSync(memoryMdPath)) {
    return false;
  }

  const content = fs.readFileSync(memoryMdPath, "utf8");
  // Normalize target without .md
  let targetLink = topicFile.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
  if (targetLink.endsWith(".md")) {
    targetLink = targetLink.slice(0, -3);
  }

  // Never index MEMORY.md in its own index
  if (targetLink === "MEMORY" || targetLink === "") {
    return false;
  }

  const wikiPattern = `[[${targetLink}]]`;
  if (content.includes(wikiPattern)) {
    return false; // Already indexed
  }

  // Check if ## Index exists
  const lines = content.split(/\r?\n/);
  const indexIdx = lines.findIndex((l) => /^##\s+Index/i.test(l.trim()));

  if (indexIdx !== -1) {
    lines.splice(indexIdx + 1, 0, `- ${wikiPattern}`);
  } else {
    lines.push("", "## Index", `- ${wikiPattern}`);
  }

  fs.writeFileSync(memoryMdPath, lines.join("\n"), "utf8");
  return true;
}

export interface WriteEntryOptions {
  file?: string;
  metadata?: MemoryMetadata;
  scope?: MemoryScope;
  commitMessage?: string;
}

/**
 * Appends a new Cognition bullet entry, updates topic files and index, and commits to git.
 */
export async function writeEntry(
  repoPath: string,
  factText: string,
  options?: WriteEntryOptions
): Promise<{ entry: MemoryEntry; committed: boolean; hash?: string }> {
  const resolvedPath = path.resolve(repoPath);
  const scope = options?.scope || "project";

  // Validate the caller's path before initialization can modify any files.
  let relFile = (options?.file || "topics/notes.md").replace(/\\/g, "/");
  if (!path.extname(relFile)) relFile += ".md";
  resolveMemoryPath(resolvedPath, relFile);
  relFile = path.relative(resolvedPath, path.resolve(resolvedPath, relFile));

  // Ensure repo exists and is initialized
  const memoryMdPath = resolveMemoryPath(resolvedPath, "MEMORY.md");
  if (!fs.existsSync(memoryMdPath)) {
    await initRepo(resolvedPath, scope);
  }

  const fullPath = resolveMemoryPath(resolvedPath, relFile);
  const fileDir = path.dirname(fullPath);
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  const today = getTodayDate();
  const metadata: MemoryMetadata = {
    added: today,
    ...(options?.metadata || {}),
  };

  const formattedLine = formatEntry(factText, metadata);

  let isNewFile = false;
  if (!fs.existsSync(fullPath)) {
    isNewFile = true;
    const baseName = path.basename(relFile, path.extname(relFile));
    const title = baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const initialContent = `# ${title}\n\n${formattedLine}\n`;
    fs.writeFileSync(fullPath, initialContent, "utf8");
  } else {
    const existingContent = fs.readFileSync(fullPath, "utf8");
    const lines = existingContent.split(/\r?\n/);
    const indexIdx = lines.findIndex((l) => /^##\s+Index/i.test(l.trim()));

    if (indexIdx !== -1) {
      // If file contains ## Index (e.g. MEMORY.md), insert the bullet BEFORE ## Index
      let insertIdx = indexIdx;
      if (insertIdx > 0 && lines[insertIdx - 1].trim() === "") {
        insertIdx = insertIdx - 1;
      }
      lines.splice(insertIdx, 0, formattedLine);
      fs.writeFileSync(fullPath, lines.join("\n"), "utf8");
    } else {
      let contentWithNewLine = existingContent;
      if (!contentWithNewLine.endsWith("\n")) {
        contentWithNewLine += "\n";
      }
      contentWithNewLine += `${formattedLine}\n`;
      fs.writeFileSync(fullPath, contentWithNewLine, "utf8");
    }
  }

  // If new file created under topics, ensure it is added to MEMORY.md Index
  if (isNewFile && relFile !== "MEMORY.md") {
    await updateIndex(resolvedPath, relFile);
  }

  // Parse resulting entry
  const content = fs.readFileSync(fullPath, "utf8");
  const parsedFile = parseMemoryFile(content, relFile, resolvedPath, scope);
  const entry = parsedFile.entries[parsedFile.entries.length - 1] || {
    raw: formattedLine,
    fact: factText.trim(),
    metadata,
    links: [],
    file: relFile,
    absPath: fullPath,
    line: parsedFile.entries.length,
    scope,
  };

  // Git commit
  const commitMsg = options?.commitMessage || `memory: write entry to ${relFile}`;
  const commitResult = await gitCommit(resolvedPath, commitMsg);

  return {
    entry,
    committed: commitResult.success,
    hash: commitResult.hash,
  };
}

/**
 * Retrieves the comprehensive status of a memory repository.
 */
export async function getStatus(
  repoPath: string,
  scope: MemoryScope
): Promise<MemoryRepoStatus> {
  const resolvedPath = path.resolve(repoPath);
  const exists = fs.existsSync(resolvedPath);
  const isGit = exists && isGitRepo(resolvedPath);

  if (!exists) {
    return {
      scope,
      path: resolvedPath,
      exists: false,
      isGit: false,
      commitCount: 0,
      fileCount: 0,
      entryCount: 0,
      brokenLinks: [],
    };
  }

  const { files, allEntries, brokenLinks } = await scanRepo(resolvedPath, scope);
  const gitStat = isGit ? await gitStatus(resolvedPath) : { clean: true, branch: "none", files: [] };
  const commitCount = isGit ? await gitCommitCount(resolvedPath) : 0;
  const recentCommits = isGit ? await gitLog(resolvedPath, 1) : [];

  return {
    scope,
    path: resolvedPath,
    exists: true,
    isGit,
    branch: gitStat.branch,
    clean: gitStat.clean,
    lastCommit: recentCommits[0],
    commitCount,
    fileCount: files.length,
    entryCount: allEntries.length,
    brokenLinks,
  };
}
