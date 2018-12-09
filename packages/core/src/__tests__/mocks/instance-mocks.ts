/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { GraphQLSchema } from 'graphql';

import { RootSchema } from '../../instance';
import { ErrorHandlingFunction } from '../../errors';

export const instanceMock = {
  errorHandlers: new Map<Function, ErrorHandlingFunction>(),
  registerSchema: jest.fn<void>(),
  registerEnum: jest.fn<void>(),
  registerRootQuery: jest.fn<void>(),
  registerRootMutation: jest.fn<void>(),
  registerErrorHandler: jest.fn<void>(),
  getRootSchema: jest.fn<RootSchema>(),
  getRootValue: jest.fn<any>(),
  rootSchemaString: '',
  rootSchema: new GraphQLSchema({ query: null }),
  rootValue: null,
};
