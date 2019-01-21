/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import chalk from 'chalk';

import { cliRunWrapper } from '../../lib/runtime';

import { ActionDescriptor } from './common';
import koaBootstrap from './koa/koa.bootstrap';

export type BootstrapOptions = {
  dry: boolean;
  template: string;
};

export async function bootstrapProject(opts: BootstrapOptions) {
  const { template } = opts;

  let actions: ActionDescriptor[];
  switch (template) {
    case 'koa':
      actions = await koaBootstrap();
      break;
    default:
      throw new Error('Invalid template. Available options: koa');
      break;
  }

  if (opts.dry) {
    console.log(
      chalk.cyan.bold('Bootstrap will perform the following actions:') + '\n',
    );

    actions.forEach(action => console.log(`Will ${action.dryDescription}\n`));

    console.log(
      chalk.cyan('Run this command without the -d / --dry flag to continue.'),
    );
  } else {
    for (const action of actions) {
      console.log(action.description + chalk.bold.blue('...'));

      await action.perform();

      console.log(chalk.bold.green('Done!'));
    }

    console.log(
      '\n' +
        chalk.green.bold('Done!') +
        ' Your project has been bootstraped succesfully 🌺.',
    );
    console.log(
      'You can now start your development server using ' +
        chalk.blue('npx blossom serve') +
        '.',
    );
    console.log(
      'Check your ' +
        chalk.blue('README.md') +
        ' file for more information / tutorials about common ops.',
    );
  }
}

export default cliRunWrapper(bootstrapProject);
