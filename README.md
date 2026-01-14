# JEAN-CLAUDE

**A companion for syncing Claude Code configuration across machines**

## Why?

You've spent hours crafting the perfect `CLAUDE.md`. Your hooks are *chef's kiss*. Your settings are dialed in just right.

Then you sit down at another machine and... nothing. Back to square one.

**Jean-Claude fixes that.** It syncs your Claude Code configuration across all your machines using Git.

## What gets synced?

- `CLAUDE.md` - Your custom instructions
- `settings.json` - Your preferences
- `hooks/` - Your automation scripts

## Installation

```bash
npm install -g jean-claude
```

## Usage

### First time setup

```bash
jean-claude init
```

You'll be asked for a Git repository URL. Create an empty private repo on GitHub/GitLab/etc and paste the URL.

### Push your config

Made changes to your Claude Code setup? Push them:

```bash
jean-claude push
```

### Pull on another machine

On a new machine, initialize with the same repo:

```bash
jean-claude init
```

Then pull the latest:

```bash
jean-claude pull
```

### Check status

See what's in sync:

```bash
jean-claude status
```

## That's it!

Four commands. No options. No complexity. Just sync.

---

*Named after the famous Belgian martial artist and philosopher, because your config deserves to do the splits across multiple machines.*
