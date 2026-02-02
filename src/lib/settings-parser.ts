import os from 'os';
import path from 'path';
import type { ExtractedFileRef } from '../types/index.js';

/**
 * Expand ~ and $HOME to absolute path
 */
export function expandPath(p: string): string {
  const home = os.homedir();
  if (p.startsWith('~/')) {
    return path.join(home, p.slice(2));
  }
  if (p.startsWith('$HOME/')) {
    return path.join(home, p.slice(6));
  }
  return p;
}

/**
 * Check if a path points to ~/.claude/ directory
 */
export function isClaudeConfigPath(p: string): boolean {
  const home = os.homedir();
  const expanded = expandPath(p);

  // Check for ~/.claude/ pattern
  if (expanded.startsWith(path.join(home, '.claude') + path.sep)) {
    return true;
  }

  // Check for /Users/*/.claude/ or /home/*/.claude/ patterns
  const userClaudePattern = /^\/(?:Users|home)\/[^/]+\/\.claude\//;
  if (userClaudePattern.test(p)) {
    return true;
  }

  return false;
}

/**
 * Extract file references from settings JSON string.
 * Looks for paths pointing to files in the claude config directory.
 */
export function extractFileReferences(settings: string): ExtractedFileRef[] {
  const refs: ExtractedFileRef[] = [];

  // Patterns to match file paths in settings
  // Match: ~/.claude/something, $HOME/.claude/something, /Users/name/.claude/something, /home/name/.claude/something
  const patterns = [
    /~\/\.claude\/[^\s"']+/g,
    /\$HOME\/\.claude\/[^\s"']+/g,
    /\/Users\/[^/]+\/\.claude\/[^\s"']+/g,
    /\/home\/[^/]+\/\.claude\/[^\s"']+/g,
  ];

  for (const pattern of patterns) {
    const matches = settings.matchAll(pattern);
    for (const match of matches) {
      const originalPath = match[0];
      const expanded = expandPath(originalPath);

      // Skip paths that are already in .jean-claude/scripts/
      if (originalPath.includes('.jean-claude/scripts/')) {
        continue;
      }

      // Skip paths to standard config files (CLAUDE.md, settings.json, etc)
      const filename = path.basename(expanded);
      if (['CLAUDE.md', 'settings.json', 'meta.json'].includes(filename)) {
        continue;
      }

      // Skip directories (hooks/, skills/)
      if (expanded.endsWith('/hooks') || expanded.endsWith('/skills')) {
        continue;
      }

      refs.push({
        originalPath,
        expandedPath: expanded,
        filename: path.basename(expanded),
        relativePath: getRelativePathFromClaude(expanded),
      });
    }
  }

  // Deduplicate by originalPath
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.originalPath)) {
      return false;
    }
    seen.add(ref.originalPath);
    return true;
  });
}

/**
 * Get the relative path from ~/.claude/ directory
 * e.g., ~/.claude/tools/script.sh -> tools/script.sh
 */
function getRelativePathFromClaude(expandedPath: string): string {
  const home = os.homedir();
  const claudeDir = path.join(home, '.claude');

  if (expandedPath.startsWith(claudeDir + path.sep)) {
    return expandedPath.slice(claudeDir.length + 1);
  }

  // Handle /Users/name/.claude/ or /home/name/.claude/ patterns
  const match = expandedPath.match(/^\/(?:Users|home)\/[^/]+\/\.claude\/(.+)$/);
  if (match) {
    return match[1];
  }

  return path.basename(expandedPath);
}

/**
 * Rewrite paths in settings to use the portable ~/.claude/.jean-claude/scripts/ location
 */
export function rewritePathsForRepo(
  settings: string,
  refs: ExtractedFileRef[]
): string {
  let result = settings;

  for (const ref of refs) {
    // Construct the new portable path
    const newPath = `~/.claude/.jean-claude/scripts/${ref.relativePath}`;
    result = result.split(ref.originalPath).join(newPath);
  }

  return result;
}

/**
 * Parse settings.json and extract statusLine configuration
 */
export function parseSettingsJson(content: string): {
  parsed: unknown;
  error: string | null;
} {
  try {
    const parsed = JSON.parse(content);
    return { parsed, error: null };
  } catch (e) {
    return {
      parsed: null,
      error: e instanceof Error ? e.message : 'Unknown parse error',
    };
  }
}
