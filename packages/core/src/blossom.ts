/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { graphql, ExecutionResult } from 'graphql';

import { IBlossomInstance } from './instance';
import { createLoaderInstance } from './loader';
import { formatGraphQLErrors } from './errors';

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
  variables?: any;
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
export function blossom(instance: IBlossomInstance) {
  // We extract here to save on the request resolving operation.
  const { errorHandlers, rootSchema, rootValue } = instance;

  return async function blossomRequestResolver(
    body: BlossomRequestBody,
    requestContext?: any,
  ): Promise<ExecutionResult<any>> {
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

    // Format errors when available
    const formattedErrors =
      response.errors && response.errors.length > 0
        ? formatGraphQLErrors(response.errors, errorHandlers)
        : response.errors;

    // Send final result.
    return {
      ...response,
      errors: formattedErrors,
    };
  };
}
