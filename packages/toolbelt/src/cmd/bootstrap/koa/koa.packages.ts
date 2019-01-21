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
    graphql: '^14.0.2',
    '@blossom-gql/core': BLOSSOM_CORE_VERSION,
    koa: '^2.6.2',
    'koa-bodyparser': '^4.2.1',
    'koa-router': '^7.4.0',
    'graphql-playground-middleware-koa': '^1.6.8',
    'source-map-support': '^0.5.9',
  },
  devDependencies: {
    jest: '^23.3.10',
    prettier: '^1.16.0',
    '@types/jest': '^23.3.10',
    '@types/node': `^10.12.18`,
    '@types/koa': '^2.0.47',
    '@types/koa-bodyparser': '^4.2.1',
    '@types/koa-router': '^7.0.38',
    '@types/graphql': '^14.0.3',
  },
};
