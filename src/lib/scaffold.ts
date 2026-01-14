import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Templates are relative to the package root
function getTemplatesDir(): string {
  // In development: src/lib -> templates
  // In production: dist/lib -> templates
  return path.resolve(__dirname, '../../templates');
}

export async function scaffoldDefaultFiles(jeanClaudeDir: string): Promise<string[]> {
  const created: string[] = [];
  const templatesDir = getTemplatesDir();

  // CLAUDE.md
  const claudeMdPath = path.join(jeanClaudeDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) {
    const templatePath = path.join(templatesDir, 'CLAUDE.md');
    if (fs.existsSync(templatePath)) {
      await fs.copy(templatePath, claudeMdPath);
    } else {
      await fs.writeFile(claudeMdPath, getDefaultClaudeMd());
    }
    created.push('CLAUDE.md');
  }

  // settings.json
  const settingsPath = path.join(jeanClaudeDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    const templatePath = path.join(templatesDir, 'settings.json');
    if (fs.existsSync(templatePath)) {
      await fs.copy(templatePath, settingsPath);
    } else {
      await fs.writeFile(settingsPath, getDefaultSettingsJson());
    }
    created.push('settings.json');
  }

  // .gitignore for the jean-claude repo
  const gitignorePath = path.join(jeanClaudeDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    await fs.writeFile(gitignorePath, getDefaultGitignore());
    created.push('.gitignore');
  }

  return created;
}

function getDefaultClaudeMd(): string {
  return `# Claude Code Configuration

This file is loaded by Claude Code at the start of every session.
Use it to provide context, instructions, and preferences.

## About Me

<!-- Add information about yourself, your preferences, coding style, etc. -->

## Project Preferences

<!-- Add any global preferences for how Claude should behave -->

## Common Tasks

<!-- Add instructions for common tasks you frequently perform -->
`;
}

function getDefaultSettingsJson(): string {
  return JSON.stringify(
    {
      // Add any default settings here
    },
    null,
    2
  );
}

function getDefaultGitignore(): string {
  return `# Jean-Claude internal files
# Uncomment the line below if you don't want to sync meta.json
# meta.json
`;
}
