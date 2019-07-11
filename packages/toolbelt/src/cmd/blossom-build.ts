/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import chalk from 'chalk';
import program from 'commander';
import fsExtra from 'fs-extra';
import webpack, { Configuration, Stats } from 'webpack';

import baseConfig from '../config/webpack.base';
import { appPath } from '../lib/paths';
import { cliRunWrapper } from '../lib/runtime';

const DEFAULT_OUTPUT_DIRECTORY = './dist';

class BlossomCompilationError extends Error {
  error!: Error;
  stats!: Stats;

  constructor(error: Error, stats: Stats) {
    super(`Compilation error: ${error.message}`);
    this.error = error;
    this.stats = stats;
  }
}

function compile(buildPath: string): Promise<Stats> {
  return new Promise<Stats>((resolve, reject) => {
    const compiler = webpack({
      ...baseConfig,
      mode: 'production',
      output: {
        filename: '[name].js',
        path: buildPath,
      },
    } as Configuration);

    compiler.run((err, stats) => {
      if (err) {
        reject(new BlossomCompilationError(err, stats));
      } else {
        resolve(stats);
      }
    });
  });
}

type CommandBuildOptions = {
  quiet?: boolean;
  outDir?: string;
};

async function build(args: CommandBuildOptions) {
  const buildDir = args.outDir || DEFAULT_OUTPUT_DIRECTORY;
  const buildPath = appPath(buildDir);
  await fsExtra.ensureDir(buildPath);

  // Compile the app
  compile(buildPath);

  // Copy package.json and lock files, if they exist.
  await fsExtra.copy(appPath('./package.json'), path.join(buildPath, 'package.json'));

  const yarnLockfile = appPath('./yarn.lock');
  if (await fsExtra.pathExists(yarnLockfile)) {
    await fsExtra.copy(yarnLockfile, path.join(buildPath, 'yarn.lock'));
  }

  const npmLockfile = appPath('./package-lock.json');
  if (await fsExtra.pathExists(npmLockfile)) {
    await fsExtra.copy(npmLockfile, path.join(buildPath, 'package-lock.json'));
  }

  if (args.quiet) {
    return;
  }

  console.log('\n' + chalk.bold.green('Compilation finished succesfully!') + '\n');
  console.log(
    'You can find your deployable artifacts in the',
    chalk.blue(buildDir),
    'directory. You are expected to run either',
    chalk.red('npm i'),
    'or',
    chalk.red('yarn'),
    'within this directory and then run any of the',
    chalk.blue('.js'),
    'files with the',
    chalk.red('node'),
    'command. You also need to set the',
    chalk.gray('NODE_ENV'),
    'environment variable to',
    chalk.blue('production'),
    'before installing dependencies and running the',
    chalk.blue('.js'),
    'files.',
  );
  console.log(); // spacer
  console.log(
    'There are multiple ways of deploying these files depending on your use case. Read the documentation for more information.',
  );
  console.log(); // spacer
}

program.option('-q, --quiet', 'Runs in quiet mode. Only outputs errors, if any.');
program.option(
  '-o, --out-dir <output-directory>',
  'Specifies the output directory for the deployment artifacts.',
  DEFAULT_OUTPUT_DIRECTORY,
);
program.action(cliRunWrapper(build));
program.parse(process.argv);
