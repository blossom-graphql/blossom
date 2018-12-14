/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import program from 'commander';

export type CommandState = {
  currentCommand: string;
  commandArgs: any[];
};

export type Command = {
  command: string;
  description?: string;
  handler: Function;
};

export const commandDict: { [key: string]: Command } = {};

export function registerCommand(
  programObject: typeof program,
  commandState: CommandState,
  commandDesc: Command,
) {
  const { command, description } = commandDesc;

  const commandInstance = programObject.command(command);
  if (description) commandInstance.description(description);

  commandInstance.action((_, ...args) => {
    commandState.currentCommand = command;
    commandState.commandArgs = args;
  });

  commandDict[command] = commandDesc;
}
