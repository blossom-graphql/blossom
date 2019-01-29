/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import chalk from 'chalk';

export function printFormattedError(error: Error) {
  console.error(chalk.bold.red('Errors Found In Operation'));

  if ((error as any).cliFormat) {
    const result: string = (error as any).cliFormat();

    console.error(result);
  } else {
    console.error(error.stack);
  }
}

export function run(fun: (...args: any[]) => Promise<any>, ...args: any[]) {
  try {
    fun(...args).catch(error => {
      printFormattedError(error);
      process.exit(1);
    });
  } catch (error) {
    printFormattedError(error);
    process.exit(1);
  }
}

export function cliRunWrapper(fun: any) {
  return (...args: any[]) => {
    run(fun, ...args);
  };
}
