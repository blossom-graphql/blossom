/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { BannerPlugin } from 'webpack';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

import { appPath } from '../lib/paths';

const baseConfig = {
  target: 'node' as 'node',
  devtool: 'source-map' as 'source-map',
  entry: {
    server: appPath('./cmd/server.ts'),
  },
  output: {
    filename: '[name].js',
    path: appPath('./dist'),
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
