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
  FieldDefinitionNode,
  GraphQLSchema,
  GraphQLError,
  ObjectTypeDefinitionNode,
  OperationTypeDefinitionNode,
  OperationTypeNode,
  SchemaDefinitionNode,
} from 'graphql';

import { BaseResolverSignature } from './common';
import { BlossomError, BlossomEmptyHandlerError } from './errors';
import COMMON_DEFINITIONS from './common-definitions';

const CONSOLIDATED_QUERY_NAMES: { [key in OperationTypeNode]: string } = {
  query: 'BlossomQuery',
  mutation: 'BlossomMutation',
  subscription: 'BlossomSubscription',
};

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
  filteredDocuments: DocumentNode[] = [];
  operationDefinitions: SchemaDefinitionNode[] = [];
  objectTypeMap: Map<string, ObjectTypeDefinitionNode> = new Map();

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

    const nonOperationDefinitions: DefinitionNode[] = [];
    const operationDefinitions: SchemaDefinitionNode[] = [];

    document.definitions.forEach(definition => {
      if (definition.kind === 'ObjectTypeDefinition') {
        if (this.objectTypeMap.has(definition.name.value)) {
          throw new Error(
            `Object with name ${
              definition.name.value
            } is already registered. This makes impossible to consolidate root queries and will throw a GraphQLError.`,
          );
        }

        this.objectTypeMap.set(definition.name.value, definition);
      }

      if (definition.kind === 'SchemaDefinition') {
        operationDefinitions.push(definition);
      } else {
        nonOperationDefinitions.push(definition);
      }
    });

    this.operationDefinitions.push(...operationDefinitions);
    this.filteredDocuments.push({
      ...document,
      definitions: nonOperationDefinitions,
    });
  }

  get finalDocument(): DocumentNode {
    const definitions: DefinitionNode[] = [];

    // Push common definitions
    definitions.push(...(COMMON_DEFINITIONS as DefinitionNode[]));

    // Push all definitions from filtered documents
    this.filteredDocuments.forEach(document => {
      definitions.push(...document.definitions);
    });

    const fields: { [key in OperationTypeNode]: FieldDefinitionNode[] } = {
      query: [],
      mutation: [],
      subscription: [],
    };

    const operationTypes: OperationTypeDefinitionNode[] = [];

    this.operationDefinitions.forEach(definition => {
      definition.operationTypes.forEach(operationType => {
        const typeName = operationType.type.name.value;
        const objectTypeDefinition = this.objectTypeMap.get(typeName);

        if (!objectTypeDefinition) {
          throw new ReferenceError(
            `Reference to name ${typeName} not found for operation type ${
              operationType.operation
            }. Is it present in any of the imported files?`,
          );
        }
        if (
          !objectTypeDefinition.fields ||
          objectTypeDefinition.fields.length === 0
        ) {
          return;
        }

        fields[operationType.operation].push(...objectTypeDefinition.fields);
      });
    });

    Object.entries(fields).forEach(([operation, fields]) => {
      if (fields.length === 0) return;

      const objectName =
        CONSOLIDATED_QUERY_NAMES[operation as OperationTypeNode];

      // Push to the list of operation types
      operationTypes.push({
        kind: 'OperationTypeDefinition',
        operation: operation as OperationTypeNode,
        type: {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: objectName,
          },
        },
      });

      // Create the object definition and push it to the list of definitions
      const finalDefinition: ObjectTypeDefinitionNode = {
        kind: 'ObjectTypeDefinition',
        name: {
          kind: 'Name',
          value: objectName,
        },
        description: {
          kind: 'StringValue',
          value: `Consolidated list of Blossom ${operation}s.`, // <- Nasty
        },
        fields,
      };
      definitions.push(finalDefinition);
    });

    if (operationTypes.length === 0) {
      throw new Error(
        "No root values registered in this schema. Won't be able to resolve anything.",
      );
    }

    // Create the final, consolidated, schema definition
    const finalSchemaDefinition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes,
    };
    definitions.push(finalSchemaDefinition);

    return {
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
    const finalObject: {
      [key: string]: ResolverSignature;
    } = {};

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
      return function registerRoot(callback: ResolverSignature) {
        instance.addRootOperation(
          'query',
          descriptor.implements,
          descriptor.using,
        );

        return callback;
      };
    },
    BlossomRootMutation(descriptor: RootDescriptor) {
      return function registerRoot(callback: ResolverSignature) {
        instance.addRootOperation(
          'mutation',
          descriptor.implements,
          descriptor.using,
        );

        return callback;
      };
    },
    BlossomError(opts: BlossomErrorInput = {}) {
      return function(errorClass: BlossomError) {
        const { handler } = opts;
        instance.addErrorHandler(errorClass, handler);

        return errorClass;
      };
    },
  };
}
