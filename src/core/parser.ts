import * as path from "node:path";
import * as fs from "node:fs";
import { MemoryEntry, MemoryFile, MemoryMetadata, MemoryScope, WikiLink } from "./types.js";

/**
 * Regular expression to match markdown bullet lines:
 * e.g., "- Fact text [source: s1; added: 2026-10-13]"
 */
const BULLET_REGEX = /^(\s*[-*+]\s+)(.+)$/;

/**
 * Regular expression to detect a trailing metadata block:
 * e.g., " [source: ...; added: ...]"
 * Matches only if the block contains at least one colon indicating key-value pairs.
 */
const TRAILING_METADATA_REGEX = /\s*\[([^\[\]]+)\]\s*$/;

/**
 * Regular expression to extract wiki-links: [[target]]
 */
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Extracts all [[wiki-link]] targets from a text string.
 */
export function extractWikiLinks(text: string): string[] {
  const matches: string[] = [];
  const regex = new RegExp(WIKILINK_REGEX);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const target = match[1]?.trim();
    if (target && !matches.includes(target)) {
      matches.push(target);
    }
  }
  return matches;
}

/**
 * Resolves a wiki-link target relative to a repository root.
 * Cognition spec:
 * - Markdown files omit the .md extension (e.g., [[topics/architecture]] -> topics/architecture.md)
 * - Non-markdown files preserve their extensions (e.g., [[scripts/bench.sh]])
 * - Supports anchors ([[topics/notes#section]]) and aliases ([[topics/notes|Label]])
 */
export function resolveWikiLink(
  target: string,
  repoRoot: string,
  sourceFile?: string
): { resolvedPath: string; exists: boolean } {
  let cleanTarget = target.trim();
  // Strip alias if present: [[target|label]]
  const pipeIdx = cleanTarget.indexOf("|");
  if (pipeIdx !== -1) {
    cleanTarget = cleanTarget.slice(0, pipeIdx).trim();
  }
  // Strip section anchor if present: [[target#anchor]]
  const hashIdx = cleanTarget.indexOf("#");
  if (hashIdx !== -1) {
    cleanTarget = cleanTarget.slice(0, hashIdx).trim();
  }

  // Prevent leading slash or relative root escapes
  cleanTarget = cleanTarget.replace(/^\/+/, "");

  const hasExt = path.extname(cleanTarget).length > 0;
  const relativePathWithExt = hasExt ? cleanTarget : `${cleanTarget}.md`;

  const normalizedRepoRoot = path.resolve(repoRoot);

  // 1. Try directly from repoRoot
  let resolvedPath = path.resolve(normalizedRepoRoot, relativePathWithExt);
  // Ensure path doesn't escape repoRoot
  if (!resolvedPath.startsWith(normalizedRepoRoot)) {
    return { resolvedPath, exists: false };
  }

  let exists = fs.existsSync(resolvedPath);

  // 2. If not found and sourceFile is provided, try relative to sourceFile directory
  if (!exists && sourceFile) {
    const sourceDir = path.dirname(path.resolve(normalizedRepoRoot, sourceFile));
    const altPath = path.resolve(sourceDir, relativePathWithExt);
    if (altPath.startsWith(normalizedRepoRoot) && fs.existsSync(altPath)) {
      resolvedPath = altPath;
      exists = true;
    }
  }

  return { resolvedPath, exists };
}

/**
 * Parses key-value pairs from a metadata string like "source: session_1; added: 2026-10-13".
 */
export function parseMetadataBlock(block: string): MemoryMetadata {
  const metadata: MemoryMetadata = {};
  const pairs = block.split(";");
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(":");
    if (colonIdx > 0) {
      const key = pair.slice(0, colonIdx).trim().toLowerCase();
      const val = pair.slice(colonIdx + 1).trim();
      if (key && val) {
        metadata[key] = val;
      }
    }
  }
  return metadata;
}

/**
 * Formats a metadata dictionary into a trailing block string:
 * e.g., " [source: session_1; added: 2026-10-13]"
 */
export function formatMetadataBlock(metadata?: MemoryMetadata): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }
  const pairs = Object.entries(metadata)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k}: ${v}`);
  if (pairs.length === 0) {
    return "";
  }
  return ` [${pairs.join("; ")}]`;
}

/**
 * Formats a single-line Cognition bullet entry.
 * Strips duplicate leading bullet markers and sanitizes internal newlines.
 */
export function formatEntry(fact: string, metadata?: MemoryMetadata): string {
  let cleanFact = fact.trim();
  // Strip leading bullet characters (- , * , + , 1. ) to prevent double bullets
  cleanFact = cleanFact.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
  // Cognition entries must be single-line: collapse internal newlines to spaces
  cleanFact = cleanFact.replace(/\r?\n\s*/g, " ").trim();
  const metaStr = formatMetadataBlock(metadata);
  return `- ${cleanFact}${metaStr}`;
}

/**
 * Parses a single line into a MemoryEntry if it matches the bullet format.
 */
export function parseEntry(
  line: string,
  file: string,
  lineNum: number,
  scope: MemoryScope,
  repoRoot: string
): MemoryEntry | null {
  const bulletMatch = line.match(BULLET_REGEX);
  if (!bulletMatch) {
    return null;
  }

  const raw = line.trim();
  let body = bulletMatch[2].trim();
  let metadata: MemoryMetadata = {};

  // Check for trailing metadata [key: val; ...]
  const metaMatch = body.match(TRAILING_METADATA_REGEX);
  if (metaMatch && metaMatch[1].includes(":")) {
    metadata = parseMetadataBlock(metaMatch[1]);
    body = body.slice(0, metaMatch.index).trim();
  }

  // Extract any wiki links from the fact body
  const linkTargets = extractWikiLinks(body);
  const links: WikiLink[] = linkTargets.map((target) => {
    const { resolvedPath, exists } = resolveWikiLink(target, repoRoot, file);
    return {
      raw: `[[${target}]]`,
      target,
      resolvedPath,
      exists,
    };
  });

  const absPath = path.resolve(repoRoot, file);

  return {
    raw,
    fact: body,
    metadata,
    links,
    file,
    absPath,
    line: lineNum,
    scope,
  };
}

/**
 * Parses a markdown memory file content into a MemoryFile structure.
 */
export function parseMemoryFile(
  content: string,
  relativePath: string,
  repoRoot: string,
  scope: MemoryScope
): MemoryFile {
  const lines = content.split(/\r?\n/);
  let title = path.basename(relativePath, path.extname(relativePath));
  const entries: MemoryEntry[] = [];
  const indexLinks: WikiLink[] = [];

  let inIndexSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check title from # Header
    if (trimmed.startsWith("# ") && !title.includes(" ")) {
      title = trimmed.slice(2).trim();
    }

    if (/^##\s+Index/i.test(trimmed)) {
      inIndexSection = true;
      continue;
    } else if (trimmed.startsWith("#") && inIndexSection) {
      inIndexSection = false;
    }

    const entry = parseEntry(line, relativePath, i + 1, scope, repoRoot);

    if (inIndexSection) {
      const targets = extractWikiLinks(line);
      for (const target of targets) {
        const { resolvedPath, exists } = resolveWikiLink(target, repoRoot, relativePath);
        indexLinks.push({
          raw: `[[${target}]]`,
          target,
          resolvedPath,
          exists,
        });
      }
    } else if (entry) {
      entries.push(entry);
    }
  }

  return {
    file: relativePath,
    absPath: path.resolve(repoRoot, relativePath),
    title,
    entries,
    indexLinks,
    content,
  };
}
