import { describe, it, expect } from 'vitest';
import os from 'os';
import {
  expandPath,
  isClaudeConfigPath,
  extractFileReferences,
  rewritePathsForRepo,
} from '../../../src/lib/settings-parser.js';

describe('settings-parser.ts', () => {
  const home = os.homedir();

  describe('expandPath', () => {
    it('should expand ~ to home directory', () => {
      const result = expandPath('~/test/file.sh');
      expect(result).toBe(`${home}/test/file.sh`);
    });

    it('should expand $HOME to home directory', () => {
      const result = expandPath('$HOME/test/file.sh');
      expect(result).toBe(`${home}/test/file.sh`);
    });

    it('should return absolute paths unchanged', () => {
      const result = expandPath('/usr/local/bin/test.sh');
      expect(result).toBe('/usr/local/bin/test.sh');
    });
  });

  describe('isClaudeConfigPath', () => {
    it('should return true for ~/.claude/ paths', () => {
      expect(isClaudeConfigPath('~/.claude/script.sh')).toBe(true);
      expect(isClaudeConfigPath('~/.claude/tools/helper.sh')).toBe(true);
    });

    it('should return true for $HOME/.claude/ paths', () => {
      expect(isClaudeConfigPath('$HOME/.claude/script.sh')).toBe(true);
    });

    it('should return true for /Users/<name>/.claude/ paths', () => {
      expect(isClaudeConfigPath('/Users/testuser/.claude/script.sh')).toBe(true);
    });

    it('should return true for /home/<name>/.claude/ paths', () => {
      expect(isClaudeConfigPath('/home/testuser/.claude/script.sh')).toBe(true);
    });

    it('should return false for other paths', () => {
      expect(isClaudeConfigPath('/usr/local/bin/script.sh')).toBe(false);
      expect(isClaudeConfigPath('~/other/script.sh')).toBe(false);
    });
  });

  describe('extractFileReferences', () => {
    it('should extract file references from settings JSON', () => {
      const settings = JSON.stringify({
        statusLine: {
          type: 'command',
          command: 'bash ~/.claude/statusline.sh',
        },
      });

      const refs = extractFileReferences(settings);

      expect(refs.length).toBe(1);
      expect(refs[0].originalPath).toBe('~/.claude/statusline.sh');
      expect(refs[0].filename).toBe('statusline.sh');
      expect(refs[0].relativePath).toBe('statusline.sh');
    });

    it('should extract multiple file references', () => {
      const settings = JSON.stringify({
        statusLine: {
          command: 'bash ~/.claude/status.sh && ~/.claude/tools/helper.sh',
        },
      });

      const refs = extractFileReferences(settings);

      expect(refs.length).toBe(2);
      expect(refs[0].originalPath).toBe('~/.claude/status.sh');
      expect(refs[1].originalPath).toBe('~/.claude/tools/helper.sh');
      expect(refs[1].relativePath).toBe('tools/helper.sh');
    });

    it('should skip paths already in .jean-claude/scripts/', () => {
      const settings = JSON.stringify({
        statusLine: {
          command: 'bash ~/.claude/.jean-claude/scripts/status.sh',
        },
      });

      const refs = extractFileReferences(settings);

      expect(refs.length).toBe(0);
    });

    it('should skip standard config files', () => {
      const settings = JSON.stringify({
        include: ['~/.claude/CLAUDE.md', '~/.claude/settings.json'],
      });

      const refs = extractFileReferences(settings);

      expect(refs.length).toBe(0);
    });

    it('should deduplicate paths', () => {
      const settings = JSON.stringify({
        cmd1: 'bash ~/.claude/script.sh',
        cmd2: 'bash ~/.claude/script.sh',
      });

      const refs = extractFileReferences(settings);

      expect(refs.length).toBe(1);
    });

    it('should handle $HOME paths', () => {
      const settings = JSON.stringify({
        command: 'bash $HOME/.claude/script.sh',
      });

      const refs = extractFileReferences(settings);

      expect(refs.length).toBe(1);
      expect(refs[0].originalPath).toBe('$HOME/.claude/script.sh');
    });
  });

  describe('rewritePathsForRepo', () => {
    it('should rewrite paths to use .jean-claude/scripts/', () => {
      const settings = JSON.stringify({
        statusLine: {
          command: 'bash ~/.claude/statusline.sh',
        },
      });

      const refs = extractFileReferences(settings);
      const rewritten = rewritePathsForRepo(settings, refs);

      expect(rewritten).toContain('~/.claude/.jean-claude/scripts/statusline.sh');
      expect(rewritten).not.toContain('"~/.claude/statusline.sh"');
    });

    it('should rewrite nested paths correctly', () => {
      const settings = JSON.stringify({
        command: 'bash ~/.claude/tools/nested/script.sh',
      });

      const refs = extractFileReferences(settings);
      const rewritten = rewritePathsForRepo(settings, refs);

      expect(rewritten).toContain('~/.claude/.jean-claude/scripts/tools/nested/script.sh');
    });

    it('should rewrite multiple paths', () => {
      const settings = JSON.stringify({
        cmd1: 'bash ~/.claude/one.sh',
        cmd2: 'bash ~/.claude/two.sh',
      });

      const refs = extractFileReferences(settings);
      const rewritten = rewritePathsForRepo(settings, refs);

      expect(rewritten).toContain('~/.claude/.jean-claude/scripts/one.sh');
      expect(rewritten).toContain('~/.claude/.jean-claude/scripts/two.sh');
    });
  });
});
