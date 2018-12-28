/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Error thrown when an operation name in SchemaDefinitionNode of the GraphQL
 * parsed Document is not supported in this library.
 */
export class UnsupportedOperationError extends Error {
  constructor(operationName: string) {
    super(
      `Unsupported operation type ${operationName}. ` +
        `Check your definitions for the schema {} declaration.`,
    );
  }
}

/**
 * Error class thrown when a type definitions is required and is not found on the
 * intermediate dictionary.
 */
export class UnknownTypeError extends Error {
  constructor(name: string) {
    super(
      `Cannot find reference for type ${name}. Did you spell it correctly? ` +
        `If this type is defined in another schema file, please import it on ` +
        `top using an #import statement.`,
    );
  }
}
