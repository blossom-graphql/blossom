/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { GraphQLError } from 'graphql';

/**
 * This type just keeps track of the extension format from the original API.
 */
type ExtensionFormat = typeof GraphQLError.prototype.extensions;

/**
 * Output of the error handling function.
 */
type ErrorHandlerOutput = {
  render: boolean;
  extensions?: ExtensionFormat;
};

/**
 * A function that receives an error (which will be available on the originalError
 * entry from GraphQLError type) and converts it to the GraphQL extension format.
 */
export type ErrorHandlingFunction = <E extends Error>(
  error: E,
) => ErrorHandlerOutput;

/**
 * Dict that associates error class to error handler.
 */
export type BlossomErrorHandlerDict = Map<Function, ErrorHandlingFunction>;

/**
 * A Blossom Error *class* (not its instance). Thus, this refers to the
 * constructor, which is usually a function. On these constructors we are
 * usually expecting to have the optional handler property sometimes.
 */
export type BlossomError = Function & { handler?: ErrorHandlingFunction };

/**
 * Receives an error and, given the error handlers dictionary, retrieves the
 * handling function and formats the error to the expected output.
 *
 * @param error The instance of the error. This will come from GraphQLError's
 * originalError key.
 *
 * @param dict Dictionary where the error handlers are stored.
 */
export function formatError<U extends Error>(
  error: U,
  dict: BlossomErrorHandlerDict,
): ErrorHandlerOutput {
  const handler = dict.get(error.constructor);

  // If there's no associated handler we don't add extensions and we simply
  // exclude them. This means this error is going as-is to the user.
  // TODO: If we support environment variables, then we should hide these
  // kind of errors and just shown an internal error.
  if (!handler) {
    return { render: true, extensions: undefined };
  }

  return handler<typeof error>(error);
}

/**
 * Receives a list of GraphQLErrors and formats each one of them when an error
 * handler is provided for their error constructors.
 *
 * @param errors List of GraphQLErrors
 * @param dict Dictionary with error handlers
 * @param errorFormatter Custom error formatter (used for testing mocking)
 */
export function formatGraphQLErrors(
  errors: ReadonlyArray<GraphQLError>,
  dict: BlossomErrorHandlerDict,
  errorFormatter = formatError,
): ReadonlyArray<GraphQLError> {
  return errors.reduce(
    (acc, error) => {
      // If there's no original error there's nothing to handle. This is usually
      // a GraphQL parsing error.
      if (!error.originalError) {
        acc.push(error);
        return acc;
      }

      // Format the error
      const { render, extensions } = errorFormatter(error, dict);

      if (render) {
        acc.push({
          ...error,
          extensions: {
            ...extensions,
            errorName: error.originalError.constructor.name,
          },
        });
      }

      // Always return the accumulated value.
      return acc;
    },
    [] as GraphQLError[],
  );
}

// =============================================================================
// CUSTOM BLOSSOM ERRORS
// =============================================================================

/**
 * Indicates that the error that is being registered hasn't been provided with
 * a custom error handler.
 */
export class BlossomEmptyHandlerError extends Error {}

/**
 * Indicates that the root value that's being tried to be registered is already
 * in use.
 */
export class BlossomRootValueAlreadyInUse extends Error {}
