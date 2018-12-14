/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Command } from './lib/commands';

import devServer from './cmd/server';

// Register all the available commands here.
const commands: Command[] = [
  {
    command: 'server',
    description: 'Starts development server on the current working dir.',
    handler: devServer,
  },
];

export default commands;
