import program from 'commander';

import serverAction from './cmd/server';

const VERSION = '0.0.0';

program.version(VERSION);

program
  .command('server')
  .description(
    'Starts the development server for this Blossom project. PWD must be an auto-generated Blossom project.',
  )
  .action(serverAction);

program.parse(process.argv);

// program.outputHelp();
