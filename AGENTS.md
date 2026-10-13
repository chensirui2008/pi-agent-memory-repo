# Repository Guidelines

## Project Structure & Module Organization

This package provides persistent, Git-backed memory for the Pi coding agent. `src/index.ts` registers tools, slash commands, and lifecycle hooks; `src/config.ts` resolves memory locations. Keep storage, parsing, search, schemas, and consolidation logic in `src/core/`, command handlers in `src/commands/`, and agent-facing tools in `src/tools/`. Bundled skill instructions live in `skills/`. Tests live in `tests/`; TypeScript emits compiled code and declarations into `dist/`. Release automation is defined in `.github/workflows/release.yml`.

## Build, Test, and Development Commands

Use Node.js 22 to match CI, with Git available for storage tests.

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run build`: compile source and tests with TypeScript.
- `npm test`: build, then run `dist/tests/*.test.js` with Node's test runner.
- `node --test dist/tests/parser.test.js`: run one suite after building.
- `pi --extension ./dist/src/index.js`: load the compiled extension locally.
- `npm pack --dry-run`: inspect package contents; the prepack hook builds first.

## Coding Style & Naming Conventions

Follow existing TypeScript style: two-space indentation, double quotes, and semicolons. Use camelCase for functions and variables, PascalCase for interfaces and types, and descriptive lowercase module filenames. Keep `.js` suffixes on relative imports for NodeNext ESM compatibility. Preserve strict compiler checks and prefer explicit types at public boundaries. No formatter or linter is currently configured; match neighboring code. Keep changes focused and avoid unnecessary abstractions.

## Testing Guidelines

Use `node:test` and `node:assert/strict`. Name files `<module>.test.ts` and describe observable behavior in test names. Add regression coverage for corrected bugs, especially path containment, consolidation idempotence, scope resolution, and Pi integration. Create temporary directories for filesystem tests, clean them up, and restore modified environment variables. No numeric coverage threshold is configured; run `npm test` before submitting changes.

## Commit & Pull Request Guidelines

Recent history uses prefixes such as `chore:`, `ci:`, and `fix(ci):`. Follow that concise, imperative style. Keep pull requests focused; explain the problem, resulting behavior, related issues, and validation performed. Update README or bundled skills when commands or tool contracts change. Version changes require care: pushes to `main` trigger CI and publish package versions absent from npm.

## Security & Configuration

For manual testing, point `AGENT_MEMORY_GLOBAL_DIR` and `AGENT_MEMORY_PROJECT_DIR` at disposable directories. Memory writes create commits; avoid recording credentials or private conversation data in fixtures. Preserve traversal and symlink containment checks around memory paths.
