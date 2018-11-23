/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

interface IValidationError {
  errors: string[];
}

export class ValidationError extends Error implements IValidationError {
  errors: string[];

  constructor(errors: string[]) {
    super(
      `ValidationError (${
        errors.length
      } errors): expand errors member for details`,
    );

    this.errors = errors;
  }
}
