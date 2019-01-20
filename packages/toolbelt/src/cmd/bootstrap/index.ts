/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { cliRunWrapper } from '../../lib/runtime';

import { ActionDescriptor } from './common';
import koaBootstrap from './koa/koa.bootstrap';
import chalk from 'chalk';

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
      chalk.yellow.bold('Bootstrap will perform the following actions:') + '\n',
    );

    actions.forEach(action => console.log(`Will ${action.description}\n`));

    console.log(
      chalk.yellow('Run this command without the -d / --dry flag to continue.'),
    );
  }
}

export default cliRunWrapper(bootstrapProject);
