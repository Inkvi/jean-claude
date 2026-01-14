import chalk from 'chalk';

export function printLogo(): void {
  const o = chalk.hex('#FF6B4A');
  const r = chalk.red;
  const w = chalk.white;
  const g = chalk.gray;

  const logo = `
       ${r('▄████▄')}
      ${r('████████')}
    ${o('██████████████')}     ${o('╻┏━╸┏━┓┏┓╻   ┏━╸╻  ┏━┓╻ ╻╺┳┓┏━╸')}
    ${o('███')}${w('▀▀')}${o('████')}${w('▀▀')}${o('███')}     ${o('┃┣╸ ┣━┫┃┗┫╺━╸┃  ┃  ┣━┫┃ ┃ ┃┃┣╸ ')}
    ${o('██████████████')}${g('━━●')}  ${o('┗┛┗━╸╹ ╹╹ ╹   ┗━╸┗━╸╹ ╹┗━┛╺┻┛┗━╸')}
      ${o('██')}${w('██████')}${o('██')}
      ${o('██')}      ${o('██')}
`;
  console.log(logo);
}
