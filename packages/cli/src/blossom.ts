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
