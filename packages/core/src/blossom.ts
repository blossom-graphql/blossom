/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { graphql, GraphQLSchema, GraphQLError } from 'graphql';

import { createLoaderInstance } from './loader';
import { BlossomValidationError, validationErrorHandler } from './errors';

/**
 * A function that receives a GraphQL.js GraphQLError and returns the same error
 * structure or a subclass of it.
 */
type BlossomErrorMappingFunction = (error: GraphQLError) => GraphQLError | any;

/**
 * A mapping between error classes constructor and their respective error
 * handlers.
 */
type BlossomErrorHandlerMapping = Map<Object, BlossomErrorMappingFunction>;

/**
 * Default error handlers mapping. Includes the errors that are automatically
 * handled by Blossom, like validation errors.
 */
const DEFAULT_ERROR_HANDLERS: BlossomErrorHandlerMapping = new Map([
  [BlossomValidationError, validationErrorHandler],
]);

/**
 * The body of a (already pre-processed) Blossom request.
 */
interface BlossomRequestBody {
  /**
   * Name of the operation. This matches the string after `query` or `mutation`
   * statements.
   */
  operationName: string;
  /**
   * String of the query involved in this operation.
   */
  query: string;
  /**
   * If the query contain variables declarations, the value of the variables
   * as a key-value object for this particular request.
   */
  variables: any;
}

/**
 * Receives a custom error mapping and returns a function that convert those
 * errors to the expected object structures to return.
 *
 * @param customErrorHandlers Mapping for the custom errors.
 */
function formatError(customErrorHandlers: BlossomErrorHandlerMapping) {
  return function errorFormatter(error: GraphQLError): GraphQLError | any {
    // Do nothing if there's no original error
    if (!error.originalError) {
      return error;
    }

    // Find if there's a handler. Otherwise do nothing.
    const handler = customErrorHandlers.get(error.originalError.constructor);
    if (!handler) {
      return error;
    }

    return handler(error);
  };
}

/**
 * Main Blossom operator. Receives an schema and its root values and returns
 * an async function that can be used to process GraphQL requests.
 *
 * @param rootSchema GraphQL schema used to serve this request. This is the
 * already parsed version, not the schema string. You must parse the schema at
 * bootstrap time and **not** at runtime.
 *
 * @param rootValue An object containing all the functions representing the
 * root values that respond to root queries.
 */
export function blossom(
  rootSchema: GraphQLSchema,
  rootValue: any,
  customErrorHandlers: BlossomErrorHandlerMapping = DEFAULT_ERROR_HANDLERS,
) {
  return async function(body: BlossomRequestBody, requestContext?: any) {
    // Prepare information to be passed to the parser.
    const { operationName, query, variables } = body;

    const context = {
      requestContext,
      loader: createLoaderInstance(),
    };

    // Actually pass the information to the parser
    const response = await graphql(
      rootSchema,
      query,
      rootValue,
      context,
      variables,
      operationName,
    );

    // If there are errors and we have
    if (response.errors && response.errors.length > 0) {
      response.errors = response.errors.map(formatError(customErrorHandlers));
    }

    return response;
  };
}
