import { spawn } from 'child_process';
import chalk from 'chalk';
import webpack, { Configuration } from 'webpack';

import baseConfig from '../config/webpack.base';
import VERSION from '../version';
import { appPath } from '../lib/paths';

function clearConsole(): void {
  process.stdout.write(new Buffer('1B63', 'hex'));
}

function startProcess() {
  const nodeSpawn = spawn('node', [appPath('./dist/server.js')]);

  nodeSpawn.stdout.pipe(process.stdout);
  nodeSpawn.stderr.pipe(process.stderr);
  process.stdin.pipe(nodeSpawn.stdin);

  nodeSpawn.on('exit', (code, signal) => {
    const message = `\n[Process exited with code ${code}${
      signal ? ` and signal ${signal}` : ''
    }]`;

    if (code !== 0) {
      console.log(chalk.red.bold(message));
    } else {
      console.log(chalk.bold(message));
    }

    if (process.stdin.isTTY) {
      console.log('Save any file or type any key to restart process.');
    }
  });
}

export default function serverAction() {
  clearConsole();

  console.log(
    '🌺',
    chalk.red.bold('Blossom'),
    '-',
    chalk.bold(`CLI v${VERSION}`),
  );
  console.log('Starting development server...');

  const compiler = webpack({
    ...baseConfig,
    mode: 'development',
  } as Configuration);

  // Warn the user that a re-compilation is happening...
  compiler.hooks.watchRun.tap('Send Warning', () => {
    console.log('');
    console.log(chalk.bold('[Re-compiling bundle...]'));
  });

  compiler.watch(
    {
      aggregateTimeout: 300,
      poll: undefined,
    },
    (_, stats) => {
      clearConsole();

      const hasErrors = stats.hasErrors();
      const hasWarnings = stats.hasWarnings();
      const compileSuccessful = !hasErrors && !hasWarnings;

      if (hasErrors) {
        console.log(chalk.bold.red('Errors found while compiling'), '\n');

        const info = stats.toJson();

        info.errors.forEach((error: string) => console.log(error));
      }

      if (hasWarnings) {
        console.log(chalk.bold.yellow('Warnings found while compiling!'), '\n');

        const info = stats.toJson();

        info.warnings.forEach((warning: string) => console.log(warning));
      }

      // We don't spawn child process when there's errors
      if (hasErrors) return;
      // ... but we do on warnings

      if (compileSuccessful) {
        console.log(
          chalk.bold.green('Compiled succesfully!'),
          chalk.bold('Starting compiled bundle...'),
          '\n',
        );
      } else {
        console.log(chalk.bold('Starting compiled bundle...'), '\n');
      }

      // Start the main process
      startProcess();
    },
  );
}
