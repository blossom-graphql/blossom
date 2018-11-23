/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { graphql, GraphQLSchema, GraphQLError } from 'graphql';

import { createLoaderInstance } from './loader';
import { ValidationError } from './errors';

interface BlossomRequestBody {
  operationName: string;
  query: string;
  variables: any;
}

function formatError(error: GraphQLError): GraphQLError | any {
  if (error.originalError instanceof ValidationError) {
    const errors = error.originalError.errors;

    return {
      ...error,
      message: `Validation Errors (${errors.length})`,
      details: errors,
    };
  } else {
    return error;
  }
}

export function blossom(rootSchema: GraphQLSchema, rootValue: any) {
  return async function(ctx: any, next: Function) {
    // Prepare information to be passed to the parser.
    const { operationName, query, variables } = <BlossomRequestBody>(
      ctx.request.body
    );
    const context = {
      requestContext: ctx,
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

    if (response.errors && response.errors.length > 0) {
      response.errors = response.errors.map(formatError);
    }

    // Deliver the response to the client.
    ctx.response.body = response;

    await next();
  };
}
