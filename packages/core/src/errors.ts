/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { GraphQLError } from 'graphql';

/**
 * A root value that needs to be added to the instance is already in use.
 */
export class RootValueAlreadyInUse extends Error {}

/**
 * Prototype for a validation error class.
 */
export interface IBlossomValidationError {
  errors: string[];
}

/**
 * A use-available error used to show validation errors on a RPC input. By
 * using the constructor multiple errors can be attached to it.
 *
 * TODO: Change errors from string[] to a interface where the field can be
 * specified.
 */
export class BlossomValidationError extends Error
  implements IBlossomValidationError {
  /**
   * List of errors of this error instance.
   */
  errors: string[];

  /**
   * Creates a new BlossomValidationError instance.
   *
   * @param errors List of validation errors.
   */
  constructor(errors: string[]) {
    super(
      `BlossomValidationError (${
        errors.length
      } errors): expand errors member for details`,
    );

    this.errors = errors;
  }
}

/**
 * Receives an error from the GraphQL error pipeline where originalError is a
 * BlossomValidationError and formats it to expected output data structure.
 *
 * @param error The error to be formatted.
 */
export function validationErrorHandler(error: GraphQLError) {
  if (!error.originalError) return error;

  const errors = (error.originalError as BlossomValidationError).errors;

  return {
    ...error,
    message: `Validation Errors (${errors.length})`,
    details: errors,
  };
}
