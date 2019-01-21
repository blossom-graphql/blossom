/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

const NODE_VERSION = process.version;

export default {
  dependencies: {
    koa: '^2.6.2',
    graphql: '^14.0.2',
    'source-map-support': '^0.5.9',
  },
  devDependencies: {
    jest: '^23.3.10',
    '@types/jest': '^23.3.10',
    '@types/node': `^${NODE_VERSION}`,
    '@types/koa': '^2.0.47',
    '@types/graphql': '^14.0.3',
  },
};
