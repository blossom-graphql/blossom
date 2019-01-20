/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import program from 'commander';

import bootstrapProject from './bootstrap';

function coerceTemplateInput(input: string): string {
  return ['koa'].includes(input) ? input : '_invalid';
}

program
  .option(
    '-t, --template <template>',
    'Template to use for bootstrapping.',
    coerceTemplateInput,
  )
  .option(
    '-d, --dry',
    'Do not write anything, just print what will be done.',
    undefined,
    false,
  )
  .parse(process.argv);

if (!program.template) {
  program.help();
}

bootstrapProject({ template: program.template, dry: program.dry });
