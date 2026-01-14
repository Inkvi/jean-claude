import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('info') + ' ' + msg),
  success: (msg: string) => console.log(chalk.green('✓') + ' ' + msg),
  warn: (msg: string) => console.log(chalk.yellow('warning') + ' ' + msg),
  error: (msg: string) => console.error(chalk.red('error') + ' ' + msg),

  step: (num: number, total: number, msg: string) => {
    console.log(chalk.dim(`[${num}/${total}]`) + ' ' + msg);
  },

  heading: (msg: string) => {
    console.log('\n' + chalk.bold(msg));
    console.log(chalk.dim('─'.repeat(msg.length)));
  },

  dim: (msg: string) => console.log(chalk.dim(msg)),

  list: (items: string[]) => {
    items.forEach((item) => console.log('  ' + chalk.dim('•') + ' ' + item));
  },

  table: (rows: [string, string][]) => {
    const maxKeyLen = Math.max(...rows.map(([k]) => k.length));
    rows.forEach(([key, value]) => {
      console.log('  ' + chalk.dim(key.padEnd(maxKeyLen)) + '  ' + value);
    });
  },
};

export function formatPath(p: string): string {
  const home = process.env.HOME || '';
  if (home && p.startsWith(home)) {
    return '~' + p.slice(home.length);
  }
  return p;
}
