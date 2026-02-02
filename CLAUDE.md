# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jean-Claude is a CLI tool that syncs Claude Code configuration (`~/.claude`) across multiple machines using Git. It manages a `.jean-claude` Git repository alongside the `.claude` config directory.

## Commands

```bash
# Build
npm run build

# Run in development (no build step)
npm run dev

# Run all tests (unit + integration)
npm test

# Run unit tests only (fast)
npm run test:unit

# Run a single unit test file
npx vitest run tests/unit/lib/sync.test.ts

# Run unit tests in watch mode
npm run test:unit:watch

# Run integration tests
npm run test:integration

# Lint
npm run lint
npm run lint:fix
```

## Architecture

```
src/
├── index.ts           # CLI entry point
├── cli.ts             # Commander.js setup, command registration
├── commands/          # CLI commands (init, push, pull, status)
├── lib/               # Core business logic
│   ├── git.ts         # Git operations via simple-git
│   ├── sync.ts        # File syncing, metadata, hash comparison
│   ├── paths.ts       # Platform-specific path resolution
│   └── settings-parser.ts  # Settings.json parsing, path extraction/rewriting
├── types/index.ts     # JeanClaudeError class, ErrorCode enum, interfaces
└── utils/             # Logger, prompts, logo display
```

**Key concepts:**
- Two-directory approach: `.jean-claude` (git repo) stays separate from `.claude` (Claude's config)
- `sync.ts` has `FILE_MAPPINGS` constant defining what gets synced (CLAUDE.md, settings.json, hooks/, skills/)
- `settings-parser.ts` extracts file references from settings.json and rewrites paths for cross-machine portability
- Platform support: macOS and Linux only (Windows throws UNSUPPORTED_PLATFORM)

## Testing

- **Unit tests** (`tests/unit/`): Vitest-based, fast, mocked dependencies
- **Integration tests** (`test-integration.sh`): Bash script testing real git repos and file system operations
