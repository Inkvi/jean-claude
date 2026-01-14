import { Command } from 'commander';
import fs from 'fs-extra';
import chalk from 'chalk';
import { logger, formatPath } from '../utils/logger.js';
import { getConfigPaths } from '../lib/paths.js';
import { isGitRepo, getGitStatus, hasMergeConflicts } from '../lib/git.js';
import { readMetaJson } from '../lib/sync.js';
import type { DoctorCheck } from '../types/index.js';

async function runChecks(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const { jeanClaudeDir, claudeConfigDir } = getConfigPaths();

  // Check 1: Directory exists
  const dirExists = fs.existsSync(jeanClaudeDir);
  checks.push({
    name: 'Jean-Claude directory exists',
    passed: dirExists,
    message: dirExists
      ? formatPath(jeanClaudeDir)
      : `${formatPath(jeanClaudeDir)} not found`,
    suggestion: dirExists ? undefined : 'Run "jean-claude init" to set up.',
  });

  if (!dirExists) {
    return checks; // Can't continue without directory
  }

  // Check 2: Is Git repo
  const isRepo = await isGitRepo(jeanClaudeDir);
  checks.push({
    name: 'Is a Git repository',
    passed: isRepo,
    message: isRepo ? 'Yes' : 'Not a Git repository',
    suggestion: isRepo
      ? undefined
      : 'Run "git init" in ~/.jean-claude or re-run "jean-claude init".',
  });

  if (!isRepo) {
    return checks; // Can't continue without Git
  }

  // Check 3: Remote configured
  const gitStatus = await getGitStatus(jeanClaudeDir);
  checks.push({
    name: 'Git remote configured',
    passed: !!gitStatus.remote,
    message: gitStatus.remote || 'No remote',
    suggestion: gitStatus.remote
      ? undefined
      : 'Add a remote: git -C ~/.jean-claude remote add origin <url>',
  });

  // Check 4: No merge conflicts
  const hasConflicts = await hasMergeConflicts(jeanClaudeDir);
  checks.push({
    name: 'No merge conflicts',
    passed: !hasConflicts,
    message: hasConflicts ? 'Conflicts detected!' : 'Clean',
    suggestion: hasConflicts
      ? 'Resolve conflicts in ~/.jean-claude before continuing.'
      : undefined,
  });

  // Check 5: Claude config directory exists
  const claudeExists = fs.existsSync(claudeConfigDir);
  checks.push({
    name: 'Claude Code config directory exists',
    passed: claudeExists,
    message: claudeExists
      ? formatPath(claudeConfigDir)
      : `${formatPath(claudeConfigDir)} not found`,
    suggestion: claudeExists
      ? undefined
      : 'Run "jean-claude pull" to create it, or start Claude Code once.',
  });

  // Check 6: meta.json is valid
  const meta = await readMetaJson(jeanClaudeDir);
  checks.push({
    name: 'meta.json is valid',
    passed: !!meta,
    message: meta ? `Machine: ${meta.machineId}` : 'Invalid or missing',
    suggestion: meta
      ? undefined
      : 'Run "jean-claude init" again to regenerate meta.json.',
  });

  // Check 7: Required files exist
  const claudeMdExists = fs.existsSync(`${jeanClaudeDir}/CLAUDE.md`);
  checks.push({
    name: 'CLAUDE.md exists',
    passed: claudeMdExists,
    message: claudeMdExists ? 'Present' : 'Missing',
    suggestion: claudeMdExists
      ? undefined
      : 'Create CLAUDE.md in ~/.jean-claude with your configuration.',
  });

  // Check 8: Permissions
  let permissionsOk = true;
  try {
    fs.accessSync(jeanClaudeDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    permissionsOk = false;
  }
  checks.push({
    name: 'Directory permissions',
    passed: permissionsOk,
    message: permissionsOk ? 'OK (read/write)' : 'Permission denied',
    suggestion: permissionsOk
      ? undefined
      : `Fix permissions: chmod -R u+rw ${formatPath(jeanClaudeDir)}`,
  });

  return checks;
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose common issues')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const checks = await runChecks();

    if (options.json) {
      console.log(JSON.stringify({ checks }, null, 2));
      const allPassed = checks.every((c) => c.passed);
      process.exit(allPassed ? 0 : 1);
      return;
    }

    logger.heading('Jean-Claude Doctor');
    console.log('');

    let allPassed = true;
    checks.forEach((check) => {
      const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${check.name}`);
      console.log(`    ${chalk.dim(check.message)}`);
      if (!check.passed && check.suggestion) {
        console.log(`    ${chalk.yellow('→')} ${check.suggestion}`);
        allPassed = false;
      }
    });

    console.log('');
    if (allPassed) {
      logger.success('All checks passed!');
    } else {
      logger.warn('Some checks failed. See suggestions above.');
      process.exit(1);
    }
  });
