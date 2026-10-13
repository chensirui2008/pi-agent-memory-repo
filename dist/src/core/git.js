import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
const execFileAsync = promisify(execFile);
/**
 * Executes a git command with fallback author configuration and HOME=/tmp.
 */
export async function runGit(args, cwd) {
    const env = {
        ...process.env,
        HOME: "/tmp",
        GIT_AUTHOR_NAME: "Agent Memory",
        GIT_AUTHOR_EMAIL: "agent@memory.local",
        GIT_COMMITTER_NAME: "Agent Memory",
        GIT_COMMITTER_EMAIL: "agent@memory.local",
    };
    const defaultArgs = [
        "-c", "user.name=Agent Memory",
        "-c", "user.email=agent@memory.local",
        "-c", "init.defaultBranch=main",
        ...args,
    ];
    try {
        const { stdout, stderr } = await execFileAsync("git", defaultArgs, {
            cwd,
            env,
            timeout: 15000,
            maxBuffer: 10 * 1024 * 1024,
        });
        return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    }
    catch (error) {
        return {
            stdout: error.stdout?.toString()?.trim() || "",
            stderr: error.stderr?.toString()?.trim() || error.message || String(error),
            exitCode: error.code || 1,
        };
    }
}
/**
 * Checks whether the given directory contains an initialized git repo.
 */
export function isGitRepo(dir) {
    try {
        const gitDir = path.join(dir, ".git");
        return fs.existsSync(gitDir) && (fs.statSync(gitDir).isDirectory() || fs.statSync(gitDir).isFile());
    }
    catch {
        return false;
    }
}
/**
 * Initializes a new git repository in the directory.
 */
export async function gitInit(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const res = await runGit(["init"], dir);
        return {
            success: res.exitCode === 0,
            output: res.stdout || res.stderr,
        };
    }
    catch (err) {
        return { success: false, output: err.message };
    }
}
/**
 * Gets git status summary (branch, clean/dirty, modified files).
 */
export async function gitStatus(dir) {
    if (!isGitRepo(dir)) {
        return { clean: true, branch: "none", files: [] };
    }
    // Get current branch
    const branchRes = await runGit(["branch", "--show-current"], dir);
    let branch = branchRes.stdout;
    if (!branch) {
        // Check if HEAD exists or unborn
        const headRes = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], dir);
        branch = headRes.stdout || "main";
    }
    // Get porcelain status
    const statusRes = await runGit(["status", "--porcelain"], dir);
    const files = [];
    if (statusRes.stdout) {
        const lines = statusRes.stdout.split("\n");
        for (const line of lines) {
            if (line.trim()) {
                files.push(line.trim());
            }
        }
    }
    return {
        clean: files.length === 0,
        branch: branch.trim() || "main",
        files,
    };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Stages all changes and commits them with the given message.
 * Includes retries with exponential backoff on index.lock contention for swarm/concurrent safety.
 */
export async function gitCommit(dir, message, maxRetries = 4) {
    if (!isGitRepo(dir)) {
        return { success: false, output: "Not a git repository" };
    }
    let lastError = "";
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Stage everything
        const addRes = await runGit(["add", "-A"], dir);
        if (addRes.exitCode !== 0) {
            lastError = `git add failed: ${addRes.stderr}`;
            if (addRes.stderr.includes("index.lock") && attempt < maxRetries - 1) {
                await sleep(60 * (attempt + 1) + Math.floor(Math.random() * 30));
                continue;
            }
            return { success: false, output: lastError };
        }
        // Check if anything is staged
        const status = await gitStatus(dir);
        if (status.clean) {
            return { success: true, output: "Nothing to commit, working tree clean" };
        }
        // Commit
        const commitRes = await runGit(["commit", "-m", message], dir);
        if (commitRes.exitCode !== 0) {
            lastError = `git commit failed: ${commitRes.stderr}`;
            if (commitRes.stderr.includes("index.lock") && attempt < maxRetries - 1) {
                await sleep(60 * (attempt + 1) + Math.floor(Math.random() * 30));
                continue;
            }
            return { success: false, output: lastError };
        }
        // Retrieve commit hash
        const hashRes = await runGit(["rev-parse", "--short", "HEAD"], dir);
        const hash = hashRes.stdout;
        return {
            success: true,
            hash,
            output: commitRes.stdout,
        };
    }
    return { success: false, output: lastError || "git commit failed due to lock contention" };
}
/**
 * Retrieves the commit history.
 */
export async function gitLog(dir, maxCount = 10) {
    if (!isGitRepo(dir)) {
        return [];
    }
    const res = await runGit(["log", `-n`, String(maxCount), `--pretty=format:%h|%s|%ai`], dir);
    if (res.exitCode !== 0 || !res.stdout) {
        return [];
    }
    const lines = res.stdout.split("\n");
    const commits = [];
    for (const line of lines) {
        const parts = line.split("|");
        if (parts.length >= 3) {
            commits.push({
                hash: parts[0].trim(),
                message: parts[1].trim(),
                date: parts.slice(2).join("|").trim(),
            });
        }
    }
    return commits;
}
/**
 * Returns total count of commits.
 */
export async function gitCommitCount(dir) {
    if (!isGitRepo(dir)) {
        return 0;
    }
    const res = await runGit(["rev-list", "--count", "HEAD"], dir);
    if (res.exitCode !== 0) {
        return 0;
    }
    const count = parseInt(res.stdout, 10);
    return isNaN(count) ? 0 : count;
}
//# sourceMappingURL=git.js.map