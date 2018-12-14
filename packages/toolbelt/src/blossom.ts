/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import program from 'commander';

import { commandDict, CommandState, registerCommand } from './lib/commands';

import VERSION from './version';
import commands from './available-commands';

const commandState: CommandState = {
  currentCommand: '',
  commandArgs: [],
};

program.version(VERSION);

// Register all of our commands
for (const command of commands) {
  registerCommand(program, commandState, command);
}

// Parse and start running.
program.parse(process.argv);

// Retrieve command from commands dictionary and invoke the handler with all
// the other arguments that could possibly be expected.
if (commandState.currentCommand) {
  const command = commandDict[commandState.currentCommand];

  if (!command) {
    throw new Error(`Command ${command} not found command dictionary.`);
  }

  command.handler(...commandState.commandArgs);
} else {
  program.outputHelp();
}
