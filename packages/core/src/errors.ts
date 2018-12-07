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
 * A function that receives an error (which will be available on the originalError
 * entry from GraphQLError type) and converts it to the GraphQL extension format.
 */
export type ErrorHandlingFunction = <E extends Error>(
  error: E,
) => ExtensionFormat;

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
function formatError<U extends Error>(
  error: U,
  dict: BlossomErrorHandlerDict,
): ExtensionFormat {
  const handler = dict.get(error.constructor);

  if (!handler) {
    return undefined;
  }

  return handler<typeof error>(error);
}

export function formatGraphQLErrors(
  errors: GraphQLError[],
  dict: BlossomErrorHandlerDict,
): GraphQLError[] {
  return errors.reduce(
    (acc, error) => {
      // If there's no original error there's nothing to handle.
      if (!error.originalError) {
        acc.push(error);
        return acc;
      }

      acc.push({
        ...error,
        extensions: formatError(error, dict),
      });
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
