/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ChildProcess } from 'child_process';

import chalk from 'chalk';

export class SpawnProcess {
  process: ChildProcess;

  constructor(childProcess: ChildProcess) {
    this.process = childProcess;
    this.createBindings();
  }

  kill() {
    this.clearBindings();
    this.process.kill('SIGKILL');
  }

  private createBindings() {
    // Pipe inputs
    this.process.stdout.pipe(process.stdout);
    this.process.stderr.pipe(process.stderr);
    process.stdin.pipe(this.process.stdin);

    // Listen to process exit
    this.process.on('exit', this.handleSignal);
  }

  private clearBindings() {
    this.process.removeAllListeners();

    process.stdin.unpipe(this.process.stdin);
    this.process.stderr.unpipe(process.stderr);
    this.process.stdout.unpipe(process.stdout);
  }

  private handleSignal = (code: number, signal?: string) => {
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
  };
}
