/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import program from 'commander';

import generateTypes from './codegen/types';

program
  .command('types')
  .alias('t')
  .description('Generates types from a GraphQL SDL.')
  .option('-f, --file <file>', 'Input GraphQL SDL from file.')
  .option('--stdin', 'Input GraphQL SDL from stdin.')
  .option('--stdout', 'Output result to stdout.')
  .option('-r, --recursive', 'Build files for all involved dependencies.')
  .option(
    '-o, --output-file [file]',
    'Path to the output file. If none specified, defaults to <filename>.types.ts.',
  )
  .action(generateTypes);

program.parse(process.argv);

// Shpw help when there are no arguments
if (!program.args.length) program.help();

// Show help when command is invalid
program.on('command:*', () => {
  program.help();
  process.exit(1);
});
