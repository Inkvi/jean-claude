# PRD: Jean-Claude

## One-liner

**Jean-Claude** keeps Claude Code behaving the same across all your machines.

---

## Problem Statement

Claude Code configuration is local and machine-specific.

For users who work across:
- macOS
- Linux
- multiple desktops / laptops

this causes **config drift**:
- identical prompts produce different behavior
- rules are forgotten or overwritten
- users waste time re-tuning Claude instead of working

Engineers can solve this with Git and dotfiles.  
Many “vibe coders” cannot or will not.

Jean-Claude solves the consistency problem **by standardizing a Git-backed workflow**.

---

## Goals

### Primary Goals
- Ensure Claude Code behaves consistently across machines
- Make Git-based syncing explicit and easy
- Provide a simple, predictable CLI workflow
- Be installable via brew / npm
- Work fully offline except for Git operations

### Non-Goals (Important)
- No automatic cloud sync beyond Git
- No background daemons
- No GUI in OSS version
- No account system
- No secret management

---

## Target Users

### Engineers (OSS users)
- Comfortable with CLI
- May or may not already use dotfiles
- Want explicit control
- Happy to use Git

This PRD focuses on **engineers first**.

---

## Canonical Config Model

Jean-Claude defines a **single canonical config directory** that is intended to live inside a Git repository.

Default location:
```
~/.jean-claude/
```

Structure:
```
~/.jean-claude/
├─ claude.md
├─ system.prompt
├─ rules.md
└─ meta.json
```

This directory:
- Is the **only source of truth**
- Is expected to be a Git repository
- Is synced manually via `jean-claude push` / `pull`

Jean-Claude never edits Git configuration outside this directory.

---

## CLI Interface

### Command: `jean-claude init`

Purpose:
- Initialize Jean-Claude on a machine
- Set up (or link to) a Git repository

Behavior:
- Ask for a Git repo URL (or use an existing local repo)
- Clone repo into `~/.jean-claude` if it does not exist
- If the directory already exists, verify it is a Git repo
- Scaffold example config files if missing
- Detect OS and Claude Code config paths

---

### Command: `jean-claude pull`

Purpose:
- Pull the latest canonical config from Git
- Apply it to the local Claude Code config

Behavior:
- Run `git pull` inside `~/.jean-claude`
- Detect merge conflicts and stop if present
- Apply updated config files to Claude Code config location
- Overwrite local Claude config explicitly

---

### Command: `jean-claude push`

Purpose:
- Push local changes to the canonical Git repo

Behavior:
- Detect modified files in `~/.jean-claude`
- Show a short diff summary
- Commit with a default message (editable via flag)
- Push to the configured remote

Safety:
- Never force-push
- Never auto-merge

---

### Command: `jean-claude status`

Purpose:
- Show sync status for this machine

Behavior:
- Show Git status (clean / dirty)
- Indicate whether local Claude config matches canonical config

---

### Command: `jean-claude doctor`

Purpose:
- Diagnose common issues

Checks:
- `~/.jean-claude` exists
- Directory is a valid Git repo
- Remote is configured
- Claude Code config path exists
- Permissions are correct

---

## Configuration Philosophy

- Git is the sync mechanism
- Jean-Claude is the coordinator, not the transport
- Explicit commands over automation
- No background behavior

---

## Packaging

- npm package: `jean-claude`
- Homebrew formula: `jean-claude`
- Platforms: macOS, Linux

---

## Open Source

- License: MIT
- Public GitHub repository
- Neutral org / namespace
- No personal branding

---

## Success Criteria

- Setup in under 5 minutes
- Identical Claude behavior across machines
- Predictable, explicit workflow
- No background processes

---

## Philosophy

Jean-Claude does not guess.  
Jean-Claude enforces consistency.
