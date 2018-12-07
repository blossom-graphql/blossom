/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { graphql, GraphQLSchema } from 'graphql';

import { createLoaderInstance } from './loader';

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
export function blossom(rootSchema: GraphQLSchema, rootValue: any) {
  return async function blossomRequestResolver(
    body: BlossomRequestBody,
    requestContext?: any,
  ) {
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

    return response;
  };
}
