---
name: agent-memory
description: Use Cognition-spec compliant Git-backed persistent memory to recall, write, and maintain durable cross-session knowledge across Universal and Project scopes.
---

# Agent Memory Repository (Cognition Open Standard)

This skill instructs the agent on navigating, recalling, recording, and maintaining durable long-term memory across sessions using the **Cognition Agent Memory Repo** open standard.

---

## 1. Core Principles & Architecture

Persistent agent memory is maintained in lightweight, version-controlled Git repositories separated into two distinct scopes:

1. **Universal Agent Memory (`~/.pi/agent-memory/`)**:
   - Cross-project user preferences, communication tone, favorite tools, custom workflows, and general habits.
2. **Project Memory (`<workspace>/.pi/memory/` or `<workspace>/.memory/`)**:
   - Repository-specific architecture, quirks, test benchmarks, build instructions, and team/swarm investigation findings.

### Memory Repository Structure

```
<memory-repo-root>/
├── .git/                      # Dedicated Git repository tracking all memory diffs
├── MEMORY.md                  # Root entry point (< 50 lines) loaded at session start
├── topics/                    # Detailed topic notes
│   ├── user_preferences.md   # Universal preferences
│   ├── architecture.md        # Architectural invariants
│   ├── testing_rules.md       # Test quirks and commands
│   ├── build_and_deploy.md    # Build/package instructions
│   └── patterns.md            # Synthesized cross-session insights
└── scripts/                   # Optional helper scripts (e.g. [[scripts/bench.sh]])
```

---

## 2. Formatting Specifications

### Single-Line Bullet Entries
Every memory fact is recorded as a single bullet item with optional bracketed metadata:

```markdown
- <Fact or Rule> [key1: value1; key2: value2]
```

#### Metadata Keys:
- `source`: The origin of the memory (e.g. `session_105`, `pr_42`, `user_instruction`, `init`).
- `added`: The date recorded in ISO format `YYYY-MM-DD`.
- `updated`: The date modified or verified.
- `type`: Category indicator (e.g. `rule`, `pattern`, `preference`).
- `status`: Lifecycle indicator (e.g. `active`, `superseded`, `deprecated`).

#### Examples:
```markdown
- Always run tests with HOME=/tmp in sandboxed environments [source: sandbox_rules; added: 2026-10-13]
- Autocomplete is called ghost_text in code and events [source: session_105; added: 2026-10-13]
- Prefer functional pure utility functions over OOP classes [source: user_pref; added: 2026-10-13]
```

### Wiki-Link Cross-Referencing
Memories are linked using wiki-link syntax: `[[target]]`.
- **Markdown files**: Omit `.md` (e.g., `[[topics/architecture]]` points to `topics/architecture.md`).
- **Non-markdown files**: Preserve the extension (e.g., `[[scripts/test.sh]]`).
- Root `MEMORY.md` contains an `## Index` section linking all active topic notes.

---

## 3. Tool Usage Workflow

When working on tasks, follow this protocol:

### Step 1: Memory Recall
When the user asks questions or assigns a task involving existing conventions, check memory first:
```json
{
  "name": "memory_recall",
  "arguments": {
    "query": "test flags or sandboxing",
    "scope": "all"
  }
}
```

### Step 2: Read Topic Files
If `memory_recall` or `MEMORY.md` points to a relevant topic via `[[topics/...]]`, read the full topic:
```json
{
  "name": "memory_read",
  "arguments": {
    "path": "topics/testing_rules"
  }
}
```

### Step 3: Record New Knowledge
When discovering a non-obvious requirement, bug resolution, or user preference:
1. Formulate a single-line factual summary.
2. Choose the appropriate topic file (or write to `MEMORY.md` if it is a top-level rule).
3. Call `memory_write`:
```json
{
  "name": "memory_write",
  "arguments": {
    "content": "Node 26 supports native TypeScript type stripping via --experimental-strip-types",
    "file": "topics/architecture.md",
    "scope": "project",
    "source": "investigation"
  }
}
```

---

## 4. Interactive Slash Commands

Users and agents can invoke slash commands:
- `/init memory [global|project|all]`: Initializes memory directories and Git repos.
- `/remember [notes]`: Autonomously distills conversation key points, presents an interactive TUI proposal modal, and commits to Git memory only after user approval.
- `/dreaming [global|project|all]`: Analyzes memories, eliminates duplicates, resolves conflicts, and synthesizes higher-level pattern rules.
- `/status`: Displays memory repository paths, Git branches, commit counts, and broken link diagnostics.


## 5. OMP adapter

OMP loads the dedicated `dist/src/omp.js` entry through `omp.extensions`; Pi uses its existing entry. Try `omp -e ./dist/src/omp.js`, or install the package locally with `omp plugin link /absolute/path/to/pi-agent-memory-repo`. Configure `memory.backend: off` in OMP's active user/project `config.yml`. This adapter does not own `/memory`, `ctx.memory`, or `memory://`.

Use `/init-memory [global|project|all]` and `/memory-status` in OMP; `/init` and `/status` remain host commands. `/dreaming` uses the same rule-based consolidation. Both hosts share the `.pi` memory directories and the two `AGENT_MEMORY_*_DIR` overrides without migration. Write sequentially across hosts; concurrent multi-process writes are not guaranteed safe.

OMP injects a root-memory snapshot at session start/switch. Writes do not refresh it until another session is loaded, while tools read current files. Loading a snapshot never creates repositories.

OMP `/remember [global|project] [note]` proposes only explicit note facts when text is supplied. Otherwise it uses the current model in a tool-free ephemeral turn with a 20-second cancellation deadline, falling back to heuristic extraction with a notice. TUI users toggle individual entries in native selectors and save selected entries; other interactive hosts confirm the full proposal. Without UI, explicit notes save directly, but automatic proposals are display-only. Cancellation, extraction with no facts, and empty proposals never write placeholders. Report a failed Git commit as files written with an incomplete commit, never as full success.
