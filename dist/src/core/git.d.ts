export interface GitExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
/**
 * Executes a git command with fallback author configuration and HOME=/tmp.
 */
export declare function runGit(args: string[], cwd: string): Promise<GitExecResult>;
/**
 * Checks whether the given directory contains an initialized git repo.
 */
export declare function isGitRepo(dir: string): boolean;
/**
 * Initializes a new git repository in the directory.
 */
export declare function gitInit(dir: string): Promise<{
    success: boolean;
    output: string;
}>;
/**
 * Gets git status summary (branch, clean/dirty, modified files).
 */
export declare function gitStatus(dir: string): Promise<{
    clean: boolean;
    branch: string;
    files: string[];
}>;
/**
 * Stages all changes and commits them with the given message.
 * Includes retries with exponential backoff on index.lock contention for swarm/concurrent safety.
 */
export declare function gitCommit(dir: string, message: string, maxRetries?: number): Promise<{
    success: boolean;
    hash?: string;
    output: string;
}>;
/**
 * Retrieves the commit history.
 */
export declare function gitLog(dir: string, maxCount?: number): Promise<Array<{
    hash: string;
    message: string;
    date: string;
}>>;
/**
 * Returns total count of commits.
 */
export declare function gitCommitCount(dir: string): Promise<number>;
//# sourceMappingURL=git.d.ts.map