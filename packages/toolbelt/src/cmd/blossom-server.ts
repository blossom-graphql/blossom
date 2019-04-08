/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { spawn } from 'child_process';
import path from 'path';

import fsExtra from 'fs-extra';
import chalk from 'chalk';
import webpack, { Configuration, Stats } from 'webpack';
import tmp from 'tmp-promise';

import VERSION from '../version';
import baseConfig from '../config/webpack.base';
import { SpawnProcess } from '../lib/processes';
import { appPath } from '../lib/paths';

/**
 * Clears the console by sending octal \033 + ascii c. This clears the console
 * in most environments. However, since this is compiled down to strict mode,
 * we cannot send the escaped string and instead we send the buffer version of
 * it.
 */
function clearConsole(): void {
  process.stdout.write(new Buffer('1B63', 'hex'));
}

/**
 * Starts a new development process.
 */
function startProcess(buildPath: string): void {
  runningProcesses.push(
    new SpawnProcess(
      spawn('node', [buildPath], {
        stdio: 'inherit',
      }),
    ),
  );
}

/**
 * Clears all the running development processes.
 */
function clearProcesses(): void {
  if (runningProcesses.length === 0) return;

  runningProcesses.forEach(process => {
    process.kill();
  });

  runningProcesses = [];
}

let firstCompilation = true;
let runningProcesses: SpawnProcess[] = [];

function makeWatcher(buildPath: string) {
  /**
   * Handler to be passed when a watch event has finally run.
   *
   * @param _ Any webpack critical error. If this is present, we should quit.
   *
   * @param stats Webpack compilation stats.
   */
  return function handleWebpackWatch(_: Error, stats: Stats) {
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
      // No filters at the moment.
      const filteredWarnings = stats.compilation.warnings.filter(_ => true);
      const hasFilteredWarnings = filteredWarnings.length > 0;

      if (hasFilteredWarnings) {
        console.log(chalk.bold.yellow('Warnings found while compiling!'), '\n');

        filteredWarnings.forEach(warning => console.log(warning));
      } else {
        compileSuccessful = !hasErrors && !hasFilteredWarnings;
      }
    }

    // We don't spawn child process when there's errors
    if (hasErrors) return;
    // ... but we do on warnings

    if (compileSuccessful) {
      firstCompilation && console.log('');
      console.log(
        chalk.bold.green('Compiled succesfully!'),
        chalk.bold('Starting compiled bundle...'),
        '\n',
      );
    } else {
      console.log(chalk.bold('Starting compiled bundle...'), '\n');
    }

    // Clear any other running process and start this new one
    clearProcesses();
    startProcess(buildPath);
  };
}

/**
 * Starts a development server based on the Koa template.
 *
 * ! TODO: When adding extra templates, these should be abstracted away in new
 * ! functions and this should just become the entrypoint based on the template
 * ! file.
 */
export async function devServer() {
  // Start on a clean slate
  clearConsole();

  // Retrieve a tmp dir
  const tmpDirPath = (await tmp.dir()).path;

  tmp.setGracefulCleanup();
  fsExtra.symlink(
    appPath('./node_modules'),
    path.join(tmpDirPath, 'node_modules'),
  );
  fsExtra.symlink(
    appPath('./package.json'),
    path.join(tmpDirPath, 'package.json'),
  );

  console.log(
    '🌺',
    chalk.red.bold('Blossom'),
    '-',
    chalk.bold(`Toolbelt v${VERSION}`),
  );
  console.log('Starting development server...');

  // Extend the base config based on our needs.
  const compiler = webpack({
    ...baseConfig,
    mode: 'development',
    output: {
      filename: '[name].js',
      path: tmpDirPath,
    },
  } as Configuration);

  // Warn the user that a re-compilation is happening...
  compiler.hooks.watchRun.tap('Send Warning', () => {
    if (firstCompilation) return;

    console.log('');
    console.log(chalk.bold('[Re-compiling bundle...]'));
  });

  // Start listening to each tick of the watch
  compiler.watch(
    {
      aggregateTimeout: 300,
      poll: undefined,
    },
    makeWatcher(path.join(tmpDirPath, 'server.js')),
  );
}

// Run
devServer();
