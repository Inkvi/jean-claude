import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  compareFiles,
  createMetaJson,
  readMetaJson,
  writeMetaJson,
  updateLastSync,
  syncFromClaudeConfig,
  syncToClaudeConfig,
} from '../../../src/lib/sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('sync.ts', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jean-claude-test-'));
  });

  afterEach(async () => {
    // Clean up
    await fs.remove(tempDir);
  });

  describe('compareFiles', () => {
    it('should return comparison results for all file mappings', () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');

      const results = compareFiles(sourceDir, targetDir);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result).toHaveProperty('mapping');
        expect(result).toHaveProperty('inSync');
        expect(result).toHaveProperty('sourceExists');
        expect(result).toHaveProperty('targetExists');
      });
    });

    it('should detect when files are missing in both locations', () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');

      const results = compareFiles(sourceDir, targetDir);

      // All files should be missing and considered in sync
      results.forEach(result => {
        expect(result.sourceExists).toBe(false);
        expect(result.targetExists).toBe(false);
        expect(result.inSync).toBe(true);
      });
    });
  });

  describe('metadata operations', () => {
    describe('createMetaJson', () => {
      it('should create valid metadata', () => {
        const claudeConfigPath = '/home/user/.claude';
        const meta = createMetaJson(claudeConfigPath);

        expect(meta).toHaveProperty('version');
        expect(meta).toHaveProperty('lastSync');
        expect(meta).toHaveProperty('machineId');
        expect(meta).toHaveProperty('platform');
        expect(meta).toHaveProperty('claudeConfigPath');

        expect(meta.version).toBe('1.0.0');
        expect(meta.lastSync).toBeNull();
        expect(meta.claudeConfigPath).toBe(claudeConfigPath);
        expect(meta.machineId).toContain('-'); // Format: hostname-hash
        expect(['linux', 'darwin']).toContain(meta.platform);
      });

      it('should generate consistent machineId for same hostname', () => {
        const meta1 = createMetaJson('/test/path');
        const meta2 = createMetaJson('/test/path');

        // Should be the same since hostname and platform are the same
        expect(meta1.machineId).toBe(meta2.machineId);
      });
    });

    describe('writeMetaJson and readMetaJson', () => {
      it('should write and read metadata correctly', async () => {
        const meta = createMetaJson('/test/path');
        const jeanClaudeDir = path.join(tempDir, '.jean-claude');
        await fs.ensureDir(jeanClaudeDir);

        await writeMetaJson(jeanClaudeDir, meta);

        const metaPath = path.join(jeanClaudeDir, 'meta.json');
        expect(await fs.pathExists(metaPath)).toBe(true);

        const readMeta = await readMetaJson(jeanClaudeDir);
        expect(readMeta).toEqual(meta);
      });

      it('should return null when meta.json does not exist', async () => {
        const jeanClaudeDir = path.join(tempDir, '.jean-claude');
        await fs.ensureDir(jeanClaudeDir);

        const meta = await readMetaJson(jeanClaudeDir);
        expect(meta).toBeNull();
      });
    });

    describe('updateLastSync', () => {
      it('should update the lastSync timestamp', async () => {
        const meta = createMetaJson('/test/path');
        const jeanClaudeDir = path.join(tempDir, '.jean-claude');
        await fs.ensureDir(jeanClaudeDir);
        await writeMetaJson(jeanClaudeDir, meta);

        expect(meta.lastSync).toBeNull();

        await updateLastSync(jeanClaudeDir);

        const updatedMeta = await readMetaJson(jeanClaudeDir);
        expect(updatedMeta?.lastSync).not.toBeNull();
        if (updatedMeta?.lastSync) {
          expect(new Date(updatedMeta.lastSync).getTime()).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('syncFromClaudeConfig', () => {
    it('should copy files from Claude config to jean-claude repo', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.jean-claude');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      // Create test files
      await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), '# Instructions');
      await fs.writeFile(path.join(claudeDir, 'settings.json'), '{"theme":"dark"}');

      const results = await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

      // Should have synced files
      expect(results.length).toBeGreaterThan(0);
      expect(await fs.pathExists(path.join(jeanClaudeDir, 'CLAUDE.md'))).toBe(true);
      expect(await fs.pathExists(path.join(jeanClaudeDir, 'settings.json'))).toBe(true);

      const claudeMd = await fs.readFile(path.join(jeanClaudeDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toBe('# Instructions');
    });

    it('should sync hooks directory', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.jean-claude');

      await fs.ensureDir(path.join(claudeDir, 'hooks'));
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(claudeDir, 'hooks', 'test.sh'), '#!/bin/bash\necho "test"');

      const results = await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

      expect(await fs.pathExists(path.join(jeanClaudeDir, 'hooks', 'test.sh'))).toBe(true);
    });
  });

  describe('syncFromClaudeConfig with file references', () => {
    it('should extract file references from settings.json and copy referenced files', async () => {
      // Use real home directory for this test since expandPath uses os.homedir()
      const home = os.homedir();
      const claudeDir = path.join(home, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.jean-claude');
      const testScript = path.join(claudeDir, 'test-statusline-temp.sh');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      // Create a temp script file in real claude dir
      await fs.writeFile(testScript, '#!/bin/bash\necho "status"');

      try {
        // Create settings.json that references the script
        await fs.writeFile(
          path.join(claudeDir, 'settings.json'),
          JSON.stringify({ statusLine: { command: `bash ~/.claude/test-statusline-temp.sh` } })
        );

        await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

        // Script should be copied to scripts/
        expect(await fs.pathExists(path.join(jeanClaudeDir, 'scripts', 'test-statusline-temp.sh'))).toBe(true);

        // Settings should have rewritten path
        const settings = await fs.readFile(path.join(jeanClaudeDir, 'settings.json'), 'utf-8');
        expect(settings).toContain('~/.claude/.jean-claude/scripts/test-statusline-temp.sh');
      } finally {
        // Clean up
        await fs.remove(testScript);
      }
    });

    it('should preserve nested directory structure for scripts', async () => {
      const home = os.homedir();
      const claudeDir = path.join(home, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.jean-claude');
      const testDir = path.join(claudeDir, 'test-tools-temp');
      const testScript = path.join(testDir, 'helper.sh');

      await fs.ensureDir(testDir);
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(testScript, '#!/bin/bash\necho "help"');

      try {
        await fs.writeFile(
          path.join(claudeDir, 'settings.json'),
          JSON.stringify({ command: 'bash ~/.claude/test-tools-temp/helper.sh' })
        );

        await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

        expect(await fs.pathExists(path.join(jeanClaudeDir, 'scripts', 'test-tools-temp', 'helper.sh'))).toBe(true);

        const settings = await fs.readFile(path.join(jeanClaudeDir, 'settings.json'), 'utf-8');
        expect(settings).toContain('~/.claude/.jean-claude/scripts/test-tools-temp/helper.sh');
      } finally {
        await fs.remove(testDir);
      }
    });

    it('should handle missing referenced files gracefully', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.jean-claude');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      // Create settings.json that references a non-existent script
      await fs.writeFile(
        path.join(claudeDir, 'settings.json'),
        JSON.stringify({ command: 'bash ~/.claude/nonexistent.sh' })
      );

      // Should not throw
      await syncFromClaudeConfig(claudeDir, jeanClaudeDir);

      // Settings should still be copied (with rewritten path)
      expect(await fs.pathExists(path.join(jeanClaudeDir, 'settings.json'))).toBe(true);
    });
  });

  describe('syncToClaudeConfig', () => {
    it('should copy files from jean-claude repo to Claude config', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.jean-claude');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(jeanClaudeDir, 'CLAUDE.md'), '# Remote Instructions');
      await fs.writeFile(path.join(jeanClaudeDir, 'settings.json'), '{"theme":"light"}');

      const results = await syncToClaudeConfig(jeanClaudeDir, claudeDir);

      expect(await fs.pathExists(path.join(claudeDir, 'CLAUDE.md'))).toBe(true);
      expect(await fs.pathExists(path.join(claudeDir, 'settings.json'))).toBe(true);

      const claudeMd = await fs.readFile(path.join(claudeDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toBe('# Remote Instructions');
    });

    it('should overwrite existing files', async () => {
      const claudeDir = path.join(tempDir, '.claude');
      const jeanClaudeDir = path.join(tempDir, '.jean-claude');

      await fs.ensureDir(claudeDir);
      await fs.ensureDir(jeanClaudeDir);

      await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), '# Old');
      await fs.writeFile(path.join(jeanClaudeDir, 'CLAUDE.md'), '# New');

      await syncToClaudeConfig(jeanClaudeDir, claudeDir);

      const claudeMd = await fs.readFile(path.join(claudeDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toBe('# New');
    });
  });
});
