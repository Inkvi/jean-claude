import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import type { FileMapping, SyncResult, MetaJson, ExtractedFileRef } from '../types/index.js';
import { getConfigPaths } from './paths.js';
import {
  extractFileReferences,
  rewritePathsForRepo,
  expandPath,
} from './settings-parser.js';

export const FILE_MAPPINGS: FileMapping[] = [
  {
    source: 'CLAUDE.md',
    target: 'CLAUDE.md',
    type: 'file',
  },
  {
    source: 'settings.json',
    target: 'settings.json',
    type: 'file',
  },
  {
    source: 'hooks',
    target: 'hooks',
    type: 'directory',
  },
  {
    source: 'skills',
    target: 'skills',
    type: 'directory',
  },
  {
    source: 'scripts',
    target: 'scripts',
    type: 'directory',
  },
];

function fileHash(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function compareFiles(
  sourceDir: string,
  targetDir: string
): Array<{ mapping: FileMapping; inSync: boolean; sourceExists: boolean; targetExists: boolean }> {
  return FILE_MAPPINGS.map((mapping) => {
    const sourcePath = path.join(sourceDir, mapping.source);
    const targetPath = path.join(targetDir, mapping.target);

    const sourceExists = fs.existsSync(sourcePath);
    const targetExists = fs.existsSync(targetPath);

    if (!sourceExists && !targetExists) {
      return { mapping, inSync: true, sourceExists, targetExists };
    }

    if (!sourceExists || !targetExists) {
      return { mapping, inSync: false, sourceExists, targetExists };
    }

    if (mapping.type === 'directory') {
      // For directories, do a simple existence check
      return { mapping, inSync: true, sourceExists, targetExists };
    }

    const sourceHash = fileHash(sourcePath);
    const targetHash = fileHash(targetPath);

    return {
      mapping,
      inSync: sourceHash === targetHash,
      sourceExists,
      targetExists,
    };
  });
}

async function listFilesRecursive(dir: string, base: string = ''): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(path.join(dir, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

export async function syncToClaudeConfig(
  jeanClaudeDir: string,
  claudeConfigDir: string,
  dryRun = false
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Ensure target directory exists
  if (!dryRun) {
    await fs.ensureDir(claudeConfigDir);
  }

  // Scripts stay in jeanClaudeDir (paths in settings.json point to ~/.claude/.jean-claude/scripts/)
  // Just ensure the scripts directory exists in jeanClaudeDir
  const scriptsSourcePath = path.join(jeanClaudeDir, 'scripts');
  if (fs.existsSync(scriptsSourcePath)) {
    const files = await listFilesRecursive(scriptsSourcePath);
    for (const file of files) {
      results.push({
        file: `scripts/${file}`,
        action: 'updated',
        source: path.join(scriptsSourcePath, file),
        target: path.join(scriptsSourcePath, file), // stays in place
      });
    }
  }

  for (const mapping of FILE_MAPPINGS) {
    // Skip scripts - they stay in jeanClaudeDir, already handled above
    if (mapping.source === 'scripts') {
      continue;
    }

    const sourcePath = path.join(jeanClaudeDir, mapping.source);
    const targetPath = path.join(claudeConfigDir, mapping.target);

    if (!fs.existsSync(sourcePath)) {
      results.push({
        file: mapping.source,
        action: 'skipped',
        source: sourcePath,
        target: targetPath,
      });
      continue;
    }

    if (mapping.type === 'directory') {
      // List individual files in directory
      const files = await listFilesRecursive(sourcePath);
      if (!dryRun) {
        await fs.copy(sourcePath, targetPath, { overwrite: true });
      }
      for (const file of files) {
        const fileTargetPath = path.join(targetPath, file);
        const fileExists = fs.existsSync(fileTargetPath);
        results.push({
          file: `${mapping.source}/${file}`,
          action: fileExists ? 'updated' : 'created',
          source: path.join(sourcePath, file),
          target: fileTargetPath,
        });
      }
    } else {
      const targetExists = fs.existsSync(targetPath);
      if (!dryRun) {
        await fs.copy(sourcePath, targetPath);
      }
      results.push({
        file: mapping.source,
        action: targetExists ? 'updated' : 'created',
        source: sourcePath,
        target: targetPath,
      });
    }
  }

  return results;
}

export async function importFromClaudeConfig(
  claudeConfigDir: string,
  jeanClaudeDir: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // First, handle settings.json specially to extract file references
  const settingsSourcePath = path.join(claudeConfigDir, 'settings.json');
  let extractedRefs: ExtractedFileRef[] = [];

  if (fs.existsSync(settingsSourcePath)) {
    try {
      const settingsContent = await fs.readFile(settingsSourcePath, 'utf-8');
      extractedRefs = extractFileReferences(settingsContent);

      // Copy referenced files to scripts/ directory
      if (extractedRefs.length > 0) {
        const scriptsDir = path.join(jeanClaudeDir, 'scripts');
        await fs.ensureDir(scriptsDir);

        for (const ref of extractedRefs) {
          const sourceFile = expandPath(ref.originalPath);
          const targetFile = path.join(scriptsDir, ref.relativePath);

          if (fs.existsSync(sourceFile)) {
            await fs.ensureDir(path.dirname(targetFile));
            await fs.copy(sourceFile, targetFile);
            results.push({
              file: `scripts/${ref.relativePath}`,
              action: 'copied',
              source: sourceFile,
              target: targetFile,
            });
          } else {
            console.warn(`Warning: Referenced file not found: ${ref.originalPath}`);
          }
        }
      }
    } catch {
      // If settings.json is malformed, we'll copy it as-is below
      extractedRefs = [];
    }
  }

  for (const mapping of FILE_MAPPINGS) {
    // Skip scripts directory - we handle it above
    if (mapping.source === 'scripts') {
      continue;
    }

    const sourcePath = path.join(claudeConfigDir, mapping.target);
    const targetPath = path.join(jeanClaudeDir, mapping.source);

    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const targetExists = fs.existsSync(targetPath);

    if (mapping.type === 'directory') {
      await fs.copy(sourcePath, targetPath, { overwrite: true });
    } else if (mapping.source === 'settings.json' && extractedRefs.length > 0) {
      // Rewrite settings.json paths for portability
      const settingsContent = await fs.readFile(sourcePath, 'utf-8');
      const rewrittenContent = rewritePathsForRepo(settingsContent, extractedRefs);
      await fs.writeFile(targetPath, rewrittenContent, 'utf-8');
    } else {
      await fs.copy(sourcePath, targetPath);
    }

    results.push({
      file: mapping.target,
      action: targetExists ? 'updated' : 'copied',
      source: sourcePath,
      target: targetPath,
    });
  }

  return results;
}

export async function syncFromClaudeConfig(
  claudeConfigDir: string,
  jeanClaudeDir: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // First, handle settings.json specially to extract file references
  const settingsSourcePath = path.join(claudeConfigDir, 'settings.json');
  let extractedRefs: ExtractedFileRef[] = [];

  if (fs.existsSync(settingsSourcePath)) {
    try {
      const settingsContent = await fs.readFile(settingsSourcePath, 'utf-8');
      extractedRefs = extractFileReferences(settingsContent);

      // Copy referenced files to scripts/ directory
      if (extractedRefs.length > 0) {
        const scriptsDir = path.join(jeanClaudeDir, 'scripts');
        await fs.ensureDir(scriptsDir);

        for (const ref of extractedRefs) {
          const sourceFile = expandPath(ref.originalPath);
          const targetFile = path.join(scriptsDir, ref.relativePath);

          if (fs.existsSync(sourceFile)) {
            await fs.ensureDir(path.dirname(targetFile));
            await fs.copy(sourceFile, targetFile);
            results.push({
              file: `scripts/${ref.relativePath}`,
              action: 'copied',
              source: sourceFile,
              target: targetFile,
            });
          } else {
            console.warn(`Warning: Referenced file not found: ${ref.originalPath}`);
          }
        }
      }
    } catch {
      // If settings.json is malformed, we'll copy it as-is below
      extractedRefs = [];
    }
  }

  for (const mapping of FILE_MAPPINGS) {
    // Skip scripts directory - we handle it above
    if (mapping.source === 'scripts') {
      continue;
    }

    const sourcePath = path.join(claudeConfigDir, mapping.target);
    const targetPath = path.join(jeanClaudeDir, mapping.source);

    if (!fs.existsSync(sourcePath)) {
      // Source doesn't exist - remove target if it exists
      if (fs.existsSync(targetPath)) {
        await fs.remove(targetPath);
        results.push({
          file: mapping.source,
          action: 'deleted',
          source: sourcePath,
          target: targetPath,
        });
      } else {
        results.push({
          file: mapping.source,
          action: 'skipped',
          source: sourcePath,
          target: targetPath,
        });
      }
      continue;
    }

    const targetExists = fs.existsSync(targetPath);

    if (mapping.type === 'directory') {
      // For directories, remove target first to ensure exact mirror
      if (targetExists) {
        await fs.remove(targetPath);
      }
      await fs.copy(sourcePath, targetPath);
    } else if (mapping.source === 'settings.json' && extractedRefs.length > 0) {
      // Rewrite settings.json paths for portability
      const settingsContent = await fs.readFile(sourcePath, 'utf-8');
      const rewrittenContent = rewritePathsForRepo(settingsContent, extractedRefs);
      await fs.writeFile(targetPath, rewrittenContent, 'utf-8');
    } else {
      await fs.copy(sourcePath, targetPath);
    }

    results.push({
      file: mapping.source,
      action: targetExists ? 'updated' : 'copied',
      source: sourcePath,
      target: targetPath,
    });
  }

  return results;
}

export function createMetaJson(claudeConfigPath: string): MetaJson {
  const { platform } = getConfigPaths();
  const hostname = os.hostname();
  const machineId = crypto
    .createHash('sha256')
    .update(hostname + platform)
    .digest('hex')
    .slice(0, 8);

  return {
    version: '1.0.0',
    lastSync: null,
    machineId: `${hostname}-${machineId}`,
    platform,
    claudeConfigPath,
  };
}

export async function readMetaJson(jeanClaudeDir: string): Promise<MetaJson | null> {
  const metaPath = path.join(jeanClaudeDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  try {
    return await fs.readJson(metaPath);
  } catch {
    return null;
  }
}

export async function writeMetaJson(
  jeanClaudeDir: string,
  meta: MetaJson
): Promise<void> {
  const metaPath = path.join(jeanClaudeDir, 'meta.json');
  await fs.writeJson(metaPath, meta, { spaces: 2 });
}

export async function updateLastSync(jeanClaudeDir: string): Promise<void> {
  const meta = await readMetaJson(jeanClaudeDir);
  if (meta) {
    meta.lastSync = new Date().toISOString();
    await writeMetaJson(jeanClaudeDir, meta);
  }
}
