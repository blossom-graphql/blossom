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
};

export default baseConfig;
