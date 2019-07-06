/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { BLOSSOM_CORE_VERSION } from '../../../lib/constants';

export default {
  dependencies: {
    graphql: '^14.4.2',
    '@blossom-gql/core': BLOSSOM_CORE_VERSION,
    koa: '^2.7.0',
    'koa-bodyparser': '^4.2.1',
    'koa-router': '^7.4.0',
    '@koa/cors': '^3.0.0',
    'graphql-playground-middleware-koa': '^1.6.8',
    'source-map-support': '^0.5.12',
  },
  devDependencies: {
    '@blossom-gql/toolbelt':
      '/Users/sebastiansoto/repositories/blossom/packages/toolbelt',
    jest: '^24.8.0',
    prettier: '^1.18.2',
    '@types/node': `^12.0.12`,
    '@types/graphql': '^14.2.2',
    '@types/jest': '^24.0.15',
    '@types/koa': '^2.0.49',
    '@types/koa-bodyparser': '^4.2.1',
    '@types/koa-router': '^7.0.38',
    '@types/koa__cors': '^2.2.3',
    '@types/webpack-env': '^1.13.9',
  },
};
