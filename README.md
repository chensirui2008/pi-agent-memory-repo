# pi-agent-memory-repo

> Cognition-spec compliant, Git-backed persistent memory repository package for the **Pi coding agent** (`pi.dev` / `@earendil-works/pi-coding-agent`).

[![npm version](https://img.shields.io/npm/v/pi-agent-memory-repo.svg)](https://www.npmjs.com/package/pi-agent-memory-repo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pi Package](https://img.shields.io/badge/Pi-Package-orange.svg)](https://pi.dev/packages)
[![Cognition Spec](https://img.shields.io/badge/Spec-Cognition_Agent_Memory-green.svg)](https://cognition.com/agent-memory-repo)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-3178C6.svg)](https://www.typescriptlang.org/)

[English](#features) | [中文说明](#中文说明)

`pi-agent-memory-repo` equips the Pi agent with durable, inspectable, and cross-session memory backed by standalone Git repositories. It faithfully implements the open [Agent Memory Repo specification](https://cognition.com/agent-memory-repo) originated by Cognition (creators of Devin).

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

### Via Pi CLI (Recommended for [pi.dev/packages](https://pi.dev/packages))

Install the package directly into Pi using the package manager:

```bash
# User-level (global across all projects)
pi install npm:pi-agent-memory-repo

# Project-level (saved into <workspace>/.pi/settings.json)
pi install --local npm:pi-agent-memory-repo

# Try in a single session without saving
pi -e npm:pi-agent-memory-repo
```

### Via npm (Library Dependency)

Install as a standard Node.js dependency:

```bash
npm install pi-agent-memory-repo
```

### Local Development / From Git

```bash
# From git repository
pi install git:github.com/pi-dev-packages/pi-agent-memory-repo

# From local directory
pi install /path/to/pi-agent-memory-repo

# Or run directly with extension flag
pi --extension /path/to/pi-agent-memory-repo/dist/src/index.js
```

---

## Memory Repository Structure

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
  ```text
  /init memory
  /init memory project
  /init memory global
  ```
- **Record Memories**:
  ```text
  /remember User prefers strict TypeScript with zero any
  /remember Always pass HOME=/tmp when running sandboxed commands
  ```
  *(Running `/remember` without arguments extracts and summarizes key learnings from recent session conversation turns)*
- **Consolidate & Dream**:
  ```text
  /dreaming
  /dreaming project
  ```
- **Inspect Status**:
  ```text
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

## 中文说明

`pi-agent-memory-repo` 是专为 **Pi 编程智能体**（`pi.dev`）设计的持久化记忆扩展包，完整遵循 Cognition（Devin 团队）发布的 [Agent Memory Repo 开放规范](https://cognition.com/agent-memory-repo)。

### 核心亮点

1. **Git 原生驱动**：所有记忆的增删、整理、索引更新均自动进行 Git Commit 记录，历史可溯、完全透明、可协同共享。
2. **双层记忆架构**：
   - **全局记忆（Universal Memory）**：存储在 `~/.pi/agent-memory/`，跨项目记录用户编码习惯、偏好和交互风格。
   - **项目记忆（Project Memory）**：存储在 `<workspace>/.pi/memory/`，记录当前代码库架构规律、测试注意事项和调试结论。
3. **梦境记忆固化（Dreaming）**：跨会话自动扫描、去重、解决冲突，并将高频共性规则归纳至 `topics/patterns.md`。
4. **轻量与开箱即用**：自带 4 个标准大模型 Tool，4 个交互式斜杠指令，并在会话启动时无缝注入上下文。

### 快速安装

```bash
# 全局安装到 Pi 智能体
pi install npm:pi-agent-memory-repo

# 项目级安装
pi install --local npm:pi-agent-memory-repo
```

---

## Development & Testing

```bash
# Compile TypeScript
npm run build

# Run unit and integration tests (38 tests across 5 suites)
npm test

# Dry-run npm pack to verify bundle contents
npm pack --dry-run
```

---

## License

[MIT](LICENSE) © 2026 Pi Agent Team
