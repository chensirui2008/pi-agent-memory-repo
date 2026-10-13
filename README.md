# pi-agent-memory-repo

> Cognition-spec compliant, Git-backed persistent memory repository package for the **Pi coding agent** (`pi.dev` / `@earendil-works/pi-coding-agent`).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pi Package](https://img.shields.io/badge/Pi-Package-orange.svg)](https://pi.dev)
[![Cognition Spec](https://img.shields.io/badge/Spec-Cognition_Agent_Memory-green.svg)](https://cognition.com/agent-memory-repo)

`pi-agent-memory-repo` equips the Pi agent with durable, inspectable, and cross-session memory backed by standalone Git repositories. It implements the open [Agent Memory Repo specification](https://cognition.com/agent-memory-repo) originated by Cognition (makers of Devin).

---

## Features

- **Cognition Open Spec Compliance**:
  - Root entry point `MEMORY.md` loaded automatically at session start (< 50 lines recommended).
  - Wiki-like cross-linking via `[[path]]` syntax (omitting `.md` for Markdown notes, preserving extensions for non-markdown assets).
  - Single-line bullet entries with structured key-value metadata:
    `- <Fact> [source: ...; added: YYYY-MM-DD]`
  - Git-backed durability: every write, initialization, and consolidation commits changes with informative messages.
- **Dual-Scope Memory Architecture**:
  - **Universal Agent Memory (`~/.pi/agent-memory/`)**: User preferences, communication tone, and cross-project knowledge.
  - **Project-Level Memory (`<workspace>/.pi/memory/`)**: Codebase architecture, build/test quirks, and session investigation findings.
- **Autonomous Memory Consolidation ("Dreaming")**:
  - Identifies cross-session patterns across observations.
  - Merges near-duplicate entries and combines sources.
  - Resolves contradictions between older and newer rules.
  - Synthesizes abstracted higher-level guidelines into `topics/patterns.md`.
- **Core Agent Tools**:
  - `memory_recall`: Keyword and relevance search across scopes.
  - `memory_write`: Appends single-line entries, creates topic files, and updates `MEMORY.md` index.
  - `memory_read`: Reads memory files and inspects resolved `[[wikilinks]]`.
  - `memory_list`: Lists directory trees, entry counts, and broken link diagnostics.
- **Interactive Slash Commands**:
  - `/init memory [global|project|all]`: Initializes memory repositories and Git commits.
  - `/remember [notes]`: Saves explicit facts or summarizes current conversation learnings.
  - `/dreaming [global|project|all]`: Runs pattern detection and memory consolidation.
  - `/status`: Displays memory repository paths, commit counts, and link health.
- **Instant Context Injection**:
  - Automatically hooks into Pi's `context` and `session_start` lifecycle events to inject `<agent_memory>` at the start of conversation turns.

---

## Installation

### In Pi Coding Agent

Add or install this package in your Pi configuration:

```bash
pi install /path/to/pi-agent-memory-repo
# or run directly with Pi
pi --extension /path/to/pi-agent-memory-repo/dist/src/index.js
```

### In `package.json`
```json
{
  "dependencies": {
    "pi-agent-memory-repo": "*"
  }
}
```

---

## Repository Structure On Disk

Each memory repository (Universal `~/.pi/agent-memory` and Project `<workspace>/.pi/memory`) adheres to the layout:

```
<memory-repo-root>/
├── .git/                      # Dedicated Git repository
├── MEMORY.md                  # Root entry point (< 50 lines)
├── topics/                    # Categorized topic notes
│   ├── notes.md               # General notes
│   ├── user_preferences.md   # Universal preferences & habits
│   ├── architecture.md        # Architectural invariants
│   ├── testing_rules.md       # Test benchmarks & CI quirks
│   └── patterns.md            # Synthesized cross-session insights
└── scripts/                   # Optional benchmark or test scripts
```

---

## Usage

### 1. Interactive Slash Commands

- **Initialize Memory**:
  ```
  /init memory
  /init memory project
  /init memory global
  ```
- **Record Memories**:
  ```
  /remember User prefers strict TypeScript with zero any
  /remember Always pass HOME=/tmp when running sandboxed commands
  ```
  *(Running `/remember` without arguments will extract and summarize key learnings from recent session conversation turns)*
- **Consolidate & Dream**:
  ```
  /dreaming
  /dreaming project
  ```
- **Inspect Status**:
  ```
  /status
  ```

### 2. Tools for LLMs

The extension registers four standard tools:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `memory_recall` | `{ query, scope?, limit? }` | Recalls memories using keyword & relevance scoring |
| `memory_write` | `{ content, file?, scope?, source? }` | Writes entry, updates index, and commits to Git |
| `memory_read` | `{ path, scope? }` | Reads file and inspects outgoing `[[links]]` |
| `memory_list` | `{ scope? }` | Summarizes repository files, entries, and link health |

---

## Configuration

The following environment variables can customize storage paths:

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `AGENT_MEMORY_GLOBAL_DIR` | `~/.pi/agent-memory` | Root path for Universal memory |
| `AGENT_MEMORY_PROJECT_DIR` | `<workspace>/.pi/memory` | Root path for Project memory |

---

## Development & Testing

```bash
# Compile TypeScript
npm run build

# Run unit and integration tests (22 tests across 5 suites)
npm test
```

---

## License

MIT © Pi Agent Team
