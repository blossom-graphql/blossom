/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import program from 'commander';

import serverAction from './cmd/server';
import VERSION from './version';

program.version(VERSION);

program
  .command('server')
  .description('Starts the development server for this Blossom project.')
  .action(serverAction);

program.parse(process.argv);

// program.outputHelp();
