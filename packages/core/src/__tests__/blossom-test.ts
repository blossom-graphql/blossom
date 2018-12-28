/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { graphql, GraphQLError } from 'graphql';
jest.mock('graphql');

import { blossom } from '../blossom';
import { createLoaderInstance, LoaderInstance } from '../loader';
import { formatGraphQLErrors } from '../errors';
jest.mock('../loader');
jest.mock('../errors');

import { instanceMock } from './mocks/instance-mocks';

const MOCKS = {
  createLoaderInstance: createLoaderInstance as jest.Mock<
    typeof createLoaderInstance
  >,
  graphql: graphql as jest.Mock<typeof graphql>,
  formatGraphQLErrors: formatGraphQLErrors as jest.Mock<
    typeof formatGraphQLErrors
  >,
};

const reusableLoaderInstanceResult = {
  instance: new LoaderInstance(),
  getLoader: () => null,
};

describe(blossom, () => {
  beforeEach(() => {
    jest.clearAllMocks();

    MOCKS.createLoaderInstance.mockReturnValueOnce(
      reusableLoaderInstanceResult,
    );
  });

  test('should have called createLoaderInstance in order to create a new loader context', async () => {
    expect.assertions(1);

    MOCKS.graphql.mockReturnValue({
      data: {}, // doesn't matter for this case
    });

    const resolve = blossom(instanceMock);

    await resolve({
      operationName: 'test',
      query: 'query testQuery { __schema { types { name } } }',
      variables: {},
    });

    expect(MOCKS.createLoaderInstance).toHaveBeenCalled();
  });

  test('should have called graphql function and return its correct value', async () => {
    expect.assertions(2);

    const blossomRequest = {
      operationName: 'test',
      query: 'query testQuery { __schema { types { name } } }',
      variables: {},
    };
    const blossomContext = {
      foo: 'bar',
    };
    const resolvedResult = {
      data: {
        __schema: {
          types: [{ name: 'test' }],
        },
      },
    };

    MOCKS.graphql.mockReturnValue(resolvedResult);

    const resolve = blossom(instanceMock);
    const result = await resolve(blossomRequest, blossomContext);

    expect(MOCKS.graphql).toHaveBeenCalledWith(
      instanceMock.rootSchema,
      blossomRequest.query,
      instanceMock.rootValue,
      { loader: reusableLoaderInstanceResult, requestContext: blossomContext },
      blossomRequest.variables,
      blossomRequest.operationName,
    );
    expect(result).toEqual(resolvedResult);
  });

  test('must not call error formatting function when errors are not defined', async () => {
    expect.assertions(1);

    MOCKS.graphql.mockReturnValue({
      data: {}, // doesn't matter for this case
    });

    const resolve = blossom(instanceMock);

    await resolve({
      operationName: 'test',
      query: 'query testQuery { __schema { types { name } } }',
      variables: {},
    });

    expect(MOCKS.formatGraphQLErrors).not.toHaveBeenCalled();
  });

  test('must not call error formatting function when errors length is zero', async () => {
    expect.assertions(1);

    MOCKS.graphql.mockReturnValue({
      data: {}, // doesn't matter for this case
      errors: [],
    });

    const resolve = blossom(instanceMock);

    await resolve({
      operationName: 'test',
      query: 'query testQuery { __schema { types { name } } }',
      variables: {},
    });

    expect(MOCKS.formatGraphQLErrors).not.toHaveBeenCalled();
  });

  test('must call formatGraphQLErrors with correct arguments and properly wire output', async () => {
    expect.assertions(2);

    const errorsResponse = [
      new GraphQLError('test1'),
      new GraphQLError('test2'),
    ];
    MOCKS.graphql.mockReturnValue({
      data: {}, // doesn't matter for this case
      errors: errorsResponse,
    });

    // We are defining here what the function returns. This is what we are
    // expecting it returns.
    const expectedReturn = [new GraphQLError('test2')];
    MOCKS.formatGraphQLErrors.mockReturnValue(expectedReturn);

    const resolve = blossom(instanceMock);

    const { errors: returnedErrors } = await resolve({
      operationName: 'test',
      query: 'query testQuery { __schema { types { name } } }',
      variables: {},
    });

    expect(MOCKS.formatGraphQLErrors).toHaveBeenCalledWith(
      errorsResponse,
      instanceMock.errorHandlers,
    );
    expect(returnedErrors).toBe(expectedReturn);
  });
});
