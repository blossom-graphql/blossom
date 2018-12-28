/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { GraphQLError } from 'graphql';

import {
  formatError,
  ErrorHandlingFunction,
  formatGraphQLErrors,
} from '../errors';

class Error1 extends Error {
  // static handler: jest.fn()
}

const error1Handler = jest.fn((_: Error1) => {
  return {
    render: true,
    extensions: {
      message: 'Error1 Test',
    },
  };
});

class UnhandledError extends Error {}

const DICT = new Map<Function, ErrorHandlingFunction>([
  [Error1, error1Handler],
]);

describe(formatError, () => {
  test('should return correct results when handler is not available', () => {
    expect(formatError(new UnhandledError(), DICT)).toEqual({
      render: true,
      extensions: undefined,
    });
  });

  test('should return correct results when handler is available', () => {
    const result = formatError(new Error1(), DICT);

    expect(result).toEqual({
      render: true,
      extensions: {
        message: 'Error1 Test',
      },
    });

    expect(error1Handler).toHaveBeenCalled();
  });
});

describe(formatGraphQLErrors, () => {
  const errorFormatterMock = jest.fn<typeof formatError>();

  beforeEach(() => errorFormatterMock.mockClear());

  test('should return empty array when empty array is provided', () => {
    expect(formatGraphQLErrors([] as GraphQLError[], DICT)).toEqual([]);
  });

  test('should return same error when GraphQLError has no original error', () => {
    const error = new GraphQLError('Test');

    const results = formatGraphQLErrors([error], DICT);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toBe(error);
  });

  test('should exclude errors that have render set to false', () => {
    const error = new GraphQLError(
      'Test',
      undefined,
      undefined,
      undefined,
      undefined,
      new Error(),
    );

    errorFormatterMock.mockReturnValue({
      render: false,
      extensions: undefined,
    });

    const results = formatGraphQLErrors([error], DICT, errorFormatterMock);

    expect(errorFormatterMock).toHaveBeenCalled();
    expect(results.length).toBe(0);
  });

  test('should include extensions with render options as true, with correct extensions', () => {
    const error = new GraphQLError(
      'Test',
      undefined,
      undefined,
      undefined,
      undefined,
      new Error(),
    );

    errorFormatterMock.mockReturnValue({
      render: true,
      extensions: { foo: 'bar' },
    });

    const results = formatGraphQLErrors([error], DICT, errorFormatterMock);

    expect(errorFormatterMock).toHaveBeenCalled();
    expect(results.length).toBe(1);
    expect(results[0].extensions).toEqual({ errorName: 'Error', foo: 'bar' });
  });

  test('should return correct values', () => {
    const error = new GraphQLError(
      'Test',
      undefined,
      undefined,
      undefined,
      undefined,
      new Error(),
    );

    errorFormatterMock
      .mockReturnValueOnce({
        render: true,
        extensions: { foo: 'bar' },
      })
      .mockReturnValueOnce({
        render: false,
      })
      .mockReturnValueOnce({
        render: true,
        extensions: { foo: 'baz' },
      });

    const results = formatGraphQLErrors(
      [error, error, error],
      DICT,
      errorFormatterMock,
    );

    expect(errorFormatterMock).toHaveBeenCalledTimes(3);
    expect(results.length).toBe(2);

    expect(results[0].extensions).toEqual({ errorName: 'Error', foo: 'bar' });
    expect(results[1].extensions).toEqual({ errorName: 'Error', foo: 'baz' });
  });
});
