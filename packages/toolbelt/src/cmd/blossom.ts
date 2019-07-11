/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import program from 'commander';

import VERSION from '../version';

program.version(VERSION, '-v, --version');

program.command('server', 'Starts development server on the current working dir.').alias('s');

program.command('bootstrap', 'Bootstraps a new Blossom project from a template.').alias('b');

program.command('codegen', 'General utility for automatic code generation.').alias('cg');

// Parse and start running.
program.parse(process.argv);

// Shpw help when there are no arguments
if (!program.args.length) program.help();

// Show help when command is invalid
program.on('command:*', () => {
  program.help();
  process.exit(1);
});
