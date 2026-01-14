import { Command } from 'commander';
import fs from 'fs-extra';
import chalk from 'chalk';
import { logger, formatPath } from '../utils/logger.js';
import { getConfigPaths } from '../lib/paths.js';
import { isGitRepo, getGitStatus } from '../lib/git.js';
import { compareFiles, readMetaJson, FILE_MAPPINGS } from '../lib/sync.js';
import { JeanClaudeError, ErrorCode } from '../types/index.js';

export const statusCommand = new Command('status')
  .description('Show sync status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { jeanClaudeDir, claudeConfigDir } = getConfigPaths();

    // Verify initialized
    if (!fs.existsSync(jeanClaudeDir)) {
      if (options.json) {
        console.log(JSON.stringify({ initialized: false }, null, 2));
        return;
      }
      throw new JeanClaudeError(
        'Jean-Claude is not initialized',
        ErrorCode.NOT_INITIALIZED,
        'Run "jean-claude init" first.'
      );
    }

    const isRepo = await isGitRepo(jeanClaudeDir);
    const gitStatus = isRepo ? await getGitStatus(jeanClaudeDir) : null;
    const meta = await readMetaJson(jeanClaudeDir);
    const fileComparison = compareFiles(jeanClaudeDir, claudeConfigDir);

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            initialized: true,
            jeanClaudeDir,
            claudeConfigDir,
            isGitRepo: isRepo,
            gitStatus,
            meta,
            files: fileComparison.map((c) => ({
              source: c.mapping.source,
              target: c.mapping.target,
              inSync: c.inSync,
              sourceExists: c.sourceExists,
              targetExists: c.targetExists,
            })),
          },
          null,
          2
        )
      );
      return;
    }

    // Pretty output
    logger.heading('Jean-Claude Status');

    console.log('');
    logger.table([
      ['Repository', formatPath(jeanClaudeDir)],
      ['Claude Config', formatPath(claudeConfigDir)],
      ['Platform', meta?.platform || 'unknown'],
    ]);

    // Git status
    console.log('');
    logger.dim('Git Status');
    if (!isRepo) {
      console.log(`  ${chalk.red('✗')} Not a Git repository`);
    } else if (gitStatus) {
      console.log(
        `  ${chalk.dim('Branch:')}  ${gitStatus.branch || 'unknown'}`
      );
      console.log(
        `  ${chalk.dim('Remote:')}  ${gitStatus.remote || chalk.yellow('none')}`
      );

      if (gitStatus.isClean) {
        console.log(`  ${chalk.green('✓')} Working tree clean`);
      } else {
        console.log(
          `  ${chalk.yellow('!')} ${gitStatus.modified.length + gitStatus.untracked.length} uncommitted change(s)`
        );
      }

      if (gitStatus.ahead > 0) {
        console.log(`  ${chalk.blue('↑')} ${gitStatus.ahead} commit(s) ahead`);
      }
      if (gitStatus.behind > 0) {
        console.log(`  ${chalk.yellow('↓')} ${gitStatus.behind} commit(s) behind`);
      }
    }

    // File sync status
    console.log('');
    logger.dim('Sync Status');
    fileComparison.forEach((c) => {
      let status: string;
      let icon: string;

      if (!c.sourceExists) {
        status = chalk.dim('not configured');
        icon = chalk.dim('-');
      } else if (!c.targetExists) {
        status = chalk.yellow('not applied');
        icon = chalk.yellow('!');
      } else if (c.inSync) {
        status = chalk.green('in sync');
        icon = chalk.green('✓');
      } else {
        status = chalk.yellow('differs');
        icon = chalk.yellow('!');
      }

      console.log(
        `  ${icon} ${c.mapping.source.padEnd(15)} ${chalk.dim('→')} ${c.mapping.target.padEnd(15)} ${status}`
      );
    });

    // Last sync
    if (meta?.lastSync) {
      console.log('');
      logger.dim(`Last sync: ${new Date(meta.lastSync).toLocaleString()}`);
    }
  });
