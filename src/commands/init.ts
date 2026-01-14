import { Command } from 'commander';
import fs from 'fs-extra';
import chalk from 'chalk';
import { logger, formatPath } from '../utils/logger.js';
import { confirm, select, input } from '../utils/prompts.js';
import { getConfigPaths, ensureDir } from '../lib/paths.js';
import { isGitRepo, initRepo, cloneRepo, addRemote } from '../lib/git.js';
import { scaffoldDefaultFiles } from '../lib/scaffold.js';
import {
  createMetaJson,
  writeMetaJson,
  syncToClaudeConfig,
  importFromClaudeConfig,
} from '../lib/sync.js';
import { JeanClaudeError, ErrorCode } from '../types/index.js';

export const initCommand = new Command('init')
  .description('Initialize Jean-Claude on this machine')
  .option('-r, --repo <url>', 'Git repository URL to clone')
  .option('--local', 'Create a local repository without remote')
  .option('--import', 'Import existing Claude Code config')
  .action(async (options) => {
    const { jeanClaudeDir, claudeConfigDir } = getConfigPaths();

    logger.heading('Jean-Claude Setup');

    // Check if already initialized
    if (fs.existsSync(jeanClaudeDir)) {
      const isRepo = await isGitRepo(jeanClaudeDir);
      if (isRepo) {
        logger.success(`Already initialized at ${formatPath(jeanClaudeDir)}`);
        logger.dim('Run "jean-claude status" to see current state.');
        return;
      }
      throw new JeanClaudeError(
        `${formatPath(jeanClaudeDir)} exists but is not a Git repository`,
        ErrorCode.NOT_GIT_REPO,
        'Remove the directory and run init again, or initialize Git manually.'
      );
    }

    // Determine setup method
    let setupMethod: 'clone' | 'local' | 'existing';

    if (options.repo) {
      setupMethod = 'clone';
    } else if (options.local) {
      setupMethod = 'local';
    } else {
      setupMethod = await select('How would you like to set up Jean-Claude?', [
        {
          name: 'Clone from a Git repository',
          value: 'clone' as const,
        },
        {
          name: 'Create a new local repository',
          value: 'local' as const,
        },
      ]);
    }

    // Execute setup
    if (setupMethod === 'clone') {
      const repoUrl =
        options.repo || (await input('Enter Git repository URL:'));

      logger.step(1, 3, 'Cloning repository...');
      await cloneRepo(repoUrl, jeanClaudeDir);
      logger.success('Repository cloned');
    } else {
      logger.step(1, 3, 'Creating local repository...');
      ensureDir(jeanClaudeDir);
      await initRepo(jeanClaudeDir);
      logger.success('Repository initialized');

      // Only ask about remote if not in explicit --local mode
      if (!options.local) {
        const wantsRemote = await confirm(
          'Would you like to add a remote repository URL?',
          false
        );
        if (wantsRemote) {
          const remoteUrl = await input('Enter remote URL:');
          await addRemote(jeanClaudeDir, remoteUrl);
          logger.success('Remote added');
        }
      }
    }

    // Scaffold default files if missing
    logger.step(2, 3, 'Setting up configuration files...');
    const created = await scaffoldDefaultFiles(jeanClaudeDir);
    if (created.length > 0) {
      logger.success(`Created: ${created.join(', ')}`);
    }

    // Create meta.json
    const meta = createMetaJson(claudeConfigDir);
    await writeMetaJson(jeanClaudeDir, meta);

    // Import existing config if requested
    if (options.import) {
      // Explicit --import flag: always import
      const imported = await importFromClaudeConfig(claudeConfigDir, jeanClaudeDir);
      if (imported.length > 0) {
        logger.success(`Imported ${imported.length} file(s) from Claude config`);
      }
    } else if (!options.local && fs.existsSync(claudeConfigDir) && setupMethod === 'local') {
      // Interactive mode: ask about importing
      const shouldImport = await confirm(
        `Import existing config from ${formatPath(claudeConfigDir)}?`,
        true
      );

      if (shouldImport) {
        const imported = await importFromClaudeConfig(claudeConfigDir, jeanClaudeDir);
        if (imported.length > 0) {
          logger.success(`Imported ${imported.length} file(s) from Claude config`);
        }
      }
    }

    // Sync to Claude config
    logger.step(3, 3, 'Applying configuration...');
    const results = await syncToClaudeConfig(jeanClaudeDir, claudeConfigDir);
    const applied = results.filter((r) => r.action !== 'skipped');
    if (applied.length > 0) {
      logger.success(`Applied ${applied.length} file(s) to Claude config`);
    }

    // Done
    console.log('');
    logger.success('Jean-Claude initialized!');
    console.log('');
    logger.dim('Next steps:');
    logger.list([
      `Edit your config at ${formatPath(jeanClaudeDir)}`,
      'Run "jean-claude push" to save changes to Git',
      'Run "jean-claude pull" on other machines to sync',
    ]);
  });
