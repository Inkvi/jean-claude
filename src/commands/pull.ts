import { Command } from 'commander';
import fs from 'fs-extra';
import chalk from 'chalk';
import { logger, formatPath } from '../utils/logger.js';
import { confirm } from '../utils/prompts.js';
import { getConfigPaths } from '../lib/paths.js';
import { isGitRepo, pull, getGitStatus, hasMergeConflicts } from '../lib/git.js';
import {
  syncToClaudeConfig,
  compareFiles,
  updateLastSync,
} from '../lib/sync.js';
import { JeanClaudeError, ErrorCode } from '../types/index.js';

export const pullCommand = new Command('pull')
  .description('Pull latest config from Git and apply to Claude Code')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('--dry-run', 'Show what would change without applying')
  .action(async (options) => {
    const { jeanClaudeDir, claudeConfigDir } = getConfigPaths();

    // Verify initialized
    if (!fs.existsSync(jeanClaudeDir)) {
      throw new JeanClaudeError(
        'Jean-Claude is not initialized',
        ErrorCode.NOT_INITIALIZED,
        'Run "jean-claude init" first.'
      );
    }

    if (!(await isGitRepo(jeanClaudeDir))) {
      throw new JeanClaudeError(
        `${formatPath(jeanClaudeDir)} is not a Git repository`,
        ErrorCode.NOT_GIT_REPO,
        'Run "jean-claude init" to set up properly.'
      );
    }

    logger.heading('Pull Configuration');

    // Check for uncommitted changes
    const gitStatus = await getGitStatus(jeanClaudeDir);
    if (!gitStatus.isClean && !options.force) {
      logger.warn('You have uncommitted changes in jean-claude config:');
      logger.list([...gitStatus.modified, ...gitStatus.untracked]);
      console.log('');
      const proceed = await confirm('Continue with pull anyway?', false);
      if (!proceed) {
        logger.dim('Aborted. Commit or stash your changes first.');
        return;
      }
    }

    // Pull from Git
    if (gitStatus.remote) {
      logger.step(1, 2, 'Pulling from Git...');
      try {
        const pullResult = await pull(jeanClaudeDir);
        logger.success(pullResult.message);
      } catch (err) {
        if (err instanceof JeanClaudeError && err.code === ErrorCode.MERGE_CONFLICT) {
          throw err;
        }
        throw err;
      }

      // Check for merge conflicts
      if (await hasMergeConflicts(jeanClaudeDir)) {
        throw new JeanClaudeError(
          'Merge conflicts detected',
          ErrorCode.MERGE_CONFLICT,
          `Resolve conflicts in ${formatPath(jeanClaudeDir)} and run pull again.`
        );
      }
    } else {
      logger.dim('No remote configured, skipping git pull.');
    }

    // Compare files
    const comparison = compareFiles(jeanClaudeDir, claudeConfigDir);
    const outOfSync = comparison.filter((c) => !c.inSync && c.sourceExists);

    if (outOfSync.length === 0 && !options.force) {
      logger.success('Everything is already in sync!');
      return;
    }

    // Show what will change
    if (outOfSync.length > 0) {
      console.log('');
      logger.dim('Files to update:');
      outOfSync.forEach((c) => {
        const action = c.targetExists ? 'update' : 'create';
        console.log(`  ${chalk.yellow(action)}  ${c.mapping.target}`);
      });
      console.log('');
    }

    if (options.dryRun) {
      logger.dim('Dry run - no changes made.');
      return;
    }

    // Confirm
    if (!options.force && outOfSync.length > 0) {
      const proceed = await confirm('Apply these changes to Claude config?', true);
      if (!proceed) {
        logger.dim('Aborted.');
        return;
      }
    }

    // Apply changes
    logger.step(2, 2, 'Applying configuration...');
    const results = await syncToClaudeConfig(jeanClaudeDir, claudeConfigDir);
    const applied = results.filter((r) => r.action !== 'skipped');

    // Update last sync time
    await updateLastSync(jeanClaudeDir);

    // Summary
    console.log('');
    logger.success(`Applied ${applied.length} file(s) to ${formatPath(claudeConfigDir)}`);
    applied.forEach((r) => {
      const icon = r.action === 'created' ? chalk.green('+') : chalk.yellow('~');
      console.log(`  ${icon} ${r.file}`);
    });
  });
