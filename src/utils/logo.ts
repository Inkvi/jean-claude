import chalk from 'chalk';
import figlet from 'figlet';

export function printLogo(): void {
  const o = chalk.hex('#FF6B4A');
  const g = chalk.gray;

  const text = figlet.textSync('JEAN-CLAUDE', { font: 'Small' });

  console.log('\n' + o(text));
  console.log(g('  A companion for syncing Claude Code configuration\n'));
}
