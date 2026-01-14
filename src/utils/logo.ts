import chalk from 'chalk';
import figlet from 'figlet';

export function printLogo(): void {
  const o = chalk.hex('#FF6B4A');
  const r = chalk.red;
  const w = chalk.white;
  const g = chalk.gray;

  // Generate JEAN-CLAUDE text
  const text = figlet.textSync('JEAN-CLAUDE', { font: 'Small' });
  const textLines = text.split('\n').filter(line => line.trim());

  // Icon lines
  const iconLines = [
    `       ${r('▄████▄')}`,
    `      ${r('████████')}`,
    `    ${o('██████████████')}`,
    `    ${o('███')}${w('▀▀')}${o('████')}${w('▀▀')}${o('███')}`,
    `    ${o('██████████████')}${g('━━●')}`,
    `      ${o('██')}${w('██████')}${o('██')}`,
    `      ${o('██')}      ${o('██')}`,
  ];

  // Pad icon lines to consistent width for alignment
  const paddedIcon = iconLines.map(line => {
    // Strip ANSI codes to get actual length
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    const padding = 22 - stripped.length;
    return line + ' '.repeat(Math.max(0, padding));
  });

  // Center text vertically relative to icon
  const textOffset = Math.floor((paddedIcon.length - textLines.length) / 2);

  const output: string[] = [];
  for (let i = 0; i < paddedIcon.length; i++) {
    const textIndex = i - textOffset;
    const textLine = textIndex >= 0 && textIndex < textLines.length ? textLines[textIndex] : '';
    output.push(paddedIcon[i] + '  ' + o(textLine));
  }

  console.log('\n' + output.join('\n'));
  console.log(g('  A companion for syncing Claude Code configuration\n'));
}
