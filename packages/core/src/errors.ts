/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { GraphQLError } from 'graphql';

export interface IBlossomValidationError {
  errors: string[];
}

export class BlossomValidationError extends Error
  implements IBlossomValidationError {
  errors: string[];

  constructor(errors: string[]) {
    super(
      `BlossomValidationError (${
        errors.length
      } errors): expand errors member for details`,
    );

    this.errors = errors;
  }
}

export function validationErrorHandler(error: GraphQLError) {
  if (!error.originalError) return error;

  const errors = (error.originalError as BlossomValidationError).errors;

  return {
    ...error,
    message: `Validation Errors (${errors.length})`,
    details: errors,
  };
}
