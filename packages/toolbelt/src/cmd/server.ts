/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { spawn } from 'child_process';

import chalk from 'chalk';
import webpack, { Configuration } from 'webpack';

import baseConfig from '../config/webpack.base';
import VERSION from '../version';
import { appPath } from '../lib/paths';
import { SpawnProcess } from '../lib/processes';

function clearConsole(): void {
  process.stdout.write(new Buffer('1B63', 'hex'));
}

function startProcess(): void {
  runningProcesses.push(
    new SpawnProcess(spawn('node', [appPath('./dist/server.js')])),
  );
}

function clearProcesses(): void {
  if (runningProcesses.length === 0) return;

  runningProcesses.forEach(process => {
    process.kill();
  });

  runningProcesses = [];
}

let firstCompilation = true;
let runningProcesses: SpawnProcess[] = [];

export default function serverAction() {
  clearConsole();

  console.log(
    '🌺',
    chalk.red.bold('Blossom'),
    '-',
    chalk.bold(`Toolbelt v${VERSION}`),
  );
  console.log('Starting development server...');

  const compiler = webpack({
    ...baseConfig,
    mode: 'development',
  } as Configuration);

  // Warn the user that a re-compilation is happening...
  compiler.hooks.watchRun.tap('Send Warning', () => {
    if (firstCompilation) return;

    console.log('');
    console.log(chalk.bold('[Re-compiling bundle...]'));
  });

  compiler.watch(
    {
      aggregateTimeout: 300,
      poll: undefined,
    },
    (_, stats) => {
      if (firstCompilation) firstCompilation = false;

      clearConsole();

      const hasErrors = stats.hasErrors();
      const hasWarnings = stats.hasWarnings();
      let compileSuccessful = !hasErrors && !hasWarnings;

      if (hasErrors) {
        console.log(chalk.bold.red('Errors found while compiling'), '\n');

        const info = stats.toJson();

        info.errors.forEach((error: string) => console.log(error));
      }

      if (hasWarnings) {
        const filteredWarnings = stats.compilation.warnings.filter(
          warning =>
            warning.name !== 'ModuleDependencyWarning' ||
            !warning.message.includes('Critical dependency'),
        );
        const hasFilteredWarnings = filteredWarnings.length > 0;

        if (hasFilteredWarnings) {
          console.log(
            chalk.bold.yellow('Warnings found while compiling!'),
            '\n',
          );

          filteredWarnings.forEach(warning => console.log(warning));
        } else {
          compileSuccessful = !hasErrors && !hasFilteredWarnings;
        }
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

      // Clear any other running process
      clearProcesses();

      // Start the main process
      startProcess();
    },
  );
}
