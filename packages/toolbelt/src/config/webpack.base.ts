/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import { BannerPlugin, Configuration } from 'webpack';
import nodeExternals from 'webpack-node-externals';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

import { appPath } from '../lib/paths';

const baseConfig: Configuration = {
  target: 'node' as 'node',
  // We are NOT bundling dependencies in the main bundle. This creates a whole
  // new set of issues because dependencies like koa or sequelize perform require
  // statements at runtime. Until a decent workaround can be found for this, the
  // sanest approach is to perform bundling on the original codebase only and
  // not in their modules.
  externals: [nodeExternals()],
  devtool: 'source-map' as 'source-map',
  entry: {
    server: appPath('./cmd/server.ts'),
  },
  resolve: {
    extensions: ['.mjs', '.ts', '.js', '.graphql', '.gql'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: appPath('./tsconfig.json'),
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.(gql|graphql)/,
        use: path.resolve(__dirname, '..', 'loaders', 'schema-loader.js'),
      },
      {
        test: /\.ts/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new BannerPlugin({
      banner: 'require("source-map-support").install();',
      raw: true,
      entryOnly: false,
    }),
  ],
};

export default baseConfig;
