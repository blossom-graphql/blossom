/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  buildASTSchema,
  DefinitionNode,
  DocumentNode,
  GraphQLSchema,
  GraphQLError,
  OperationTypeNode,
} from 'graphql';

import { BaseResolverSignature } from './common';
import { BlossomError, BlossomEmptyHandlerError } from './errors';
import { resolve, resolveArray } from './resolver';
import COMMON_DEFINITIONS from './common-definitions';

export type ResolverSignature = BaseResolverSignature<any, any, any>;

export type RootValueOutput = {
  [key: string]: ResolverSignature;
};

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
 * Options for the Blossom Error accumulator function.
 */
type BlossomErrorInput = {
  /**
   * Error handling function. If empty, the handler must be provided as a static
   * handler method in the error class.
   */
  handler?: ErrorHandlingFunction;
};

export interface IBlossomInstance {
  errorHandlers: BlossomErrorHandlerDict;
  addDocument: (document: DocumentNode) => void;
  finalDocument: DocumentNode;
  rootSchema: GraphQLSchema;
  addRootOperation: (
    operation: OperationTypeNode,
    name: string,
    callback: ResolverSignature,
  ) => void;
  rootValue: RootValueOutput;
  addErrorHandler: (
    errorClass: BlossomError,
    handlingFunction?: ErrorHandlingFunction,
  ) => void;
}

export class BlossomInstance implements IBlossomInstance {
  rawDocuments: DocumentNode[] = [];
  operationDefinitions: DefinitionNode[] = [];

  rootOperationsMap: Map<
    string,
    {
      operation: OperationTypeNode;
      callback: ResolverSignature;
    }
  > = new Map();

  /**
   * Mapping for introducing error handlers in the instance.
   */
  errorHandlers: BlossomErrorHandlerDict = new Map();

  addDocument(document: DocumentNode) {
    this.rawDocuments.push(document);
    this.operationDefinitions.push(...document.definitions);
  }

  get finalDocument(): DocumentNode {
    const definitions: DefinitionNode[] = [
      ...(COMMON_DEFINITIONS as DefinitionNode[]),
      ...this.operationDefinitions,
    ];

    return {
      ...this.rawDocuments[0],
      kind: 'Document',
      definitions,
    };
  }

  get rootSchema(): GraphQLSchema {
    return buildASTSchema(this.finalDocument);
  }

  addRootOperation(
    operation: OperationTypeNode,
    name: string,
    callback: ResolverSignature,
  ): void {
    const existingOperation = this.rootOperationsMap.get(name);
    if (existingOperation) {
      throw new ReferenceError(
        `Operation ${name} already registered as ${existingOperation} on instance.`,
      );
    }

    this.rootOperationsMap.set(name, { operation, callback });
  }

  get rootValue(): RootValueOutput {
    const finalObject: RootValueOutput = {};

    for (const [name, { callback }] of this.rootOperationsMap) {
      finalObject[name] = callback;
    }

    return finalObject;
  }

  /**
   * Registers an error handler for this Blossom instance.
   *
   * @param errorClass Constructor of the error class.
   *
   * @param handlingFunction Function that handles the error. If no function is
   * provided, will try to retrieve handler from the static handler() method
   * of the constructor.
   */
  addErrorHandler(
    errorClass: BlossomError,
    handlingFunction?: ErrorHandlingFunction,
  ) {
    if (this.errorHandlers.has(errorClass)) {
      throw new BlossomEmptyHandlerError(
        `${errorClass.name} error handler already registered`,
      );
    }

    if (handlingFunction) {
      this.errorHandlers.set(errorClass, handlingFunction);
    } else if (errorClass.handler) {
      this.errorHandlers.set(errorClass, errorClass.handler);
    } else {
      throw new BlossomEmptyHandlerError(
        `If handlingFunction parameter is empty, errorClass.handler must be implemented`,
      );
    }
  }
}

export type RootDescriptor = {
  implements: string;
  using: ResolverSignature;
};

export function createBlossomDecorators(instance: IBlossomInstance) {
  return {
    BlossomRootQuery(descriptor: RootDescriptor) {
      instance.addRootOperation(
        'query',
        descriptor.implements,
        descriptor.using,
      );
    },
    BlossomRootMutation(descriptor: RootDescriptor) {
      instance.addRootOperation(
        'mutation',
        descriptor.implements,
        descriptor.using,
      );
    },
    BlossomError(opts: BlossomErrorInput = {}) {
      return function(errorClass: BlossomError) {
        const { handler } = opts;
        instance.addErrorHandler(errorClass, handler);

        return errorClass;
      };
    },
    // At the moment we are directly exposing these. In the future, we'd like
    // to stack middleware chains that the user can configure. Tracing,
    // monitoring, logging come to mind.
    resolve,
    resolveArray,
  };
}
