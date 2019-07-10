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
  OperationTypeNode,
  DirectiveNode,
} from 'graphql';

import {
  BlossomError,
  BlossomEmptyHandlerError,
  ErrorHandlingFunction,
  BlossomErrorHandlerDict,
} from './errors';
import COMMON_DEFINITIONS from './common-definitions';
import { IBlossomInstance, ResolverSignature, RootValueOutput } from './common';
import { hasConnectionDirectiveHandler } from './directives';
import { ExtensionMap } from './extensions';
import { createConnectionResolver, resolve, resolveArray } from './resolver';

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

export class BlossomInstance implements IBlossomInstance {
  rawDocuments: DocumentNode[] = [];
  definitions: DefinitionNode[] = [];
  extensionMap: ExtensionMap = new ExtensionMap();
  runtimeDirectiveHandler = new Map([
    ['hasConnection', hasConnectionDirectiveHandler],
  ]);

  rootOperationsMap: Map<
    string,
    {
      operation: OperationTypeNode;
      callback: ResolverSignature;
    }
  > = new Map();

  /**
   * Mapping for introducing error handlers in the instance.
   *
   * TODO: Add a common set of errors that can be automatically thrown.
   */
  errorHandlers: BlossomErrorHandlerDict = new Map();

  addDefinition(definition: DefinitionNode) {
    this.definitions.push(definition);

    if (definition.kind === 'ObjectTypeDefinition')
      this.extensionMap.addDefinition(definition);

    if (definition.kind === 'ObjectTypeExtension')
      this.extensionMap.addExtension(definition);
  }

  addDocument(document: DocumentNode) {
    this.rawDocuments.push(document);

    document.definitions.forEach(definition => {
      this.addDefinition(definition);
      handleDirectives(this, definition);
    });
  }

  get finalDocument(): DocumentNode {
    const definitions: DefinitionNode[] = [
      ...(COMMON_DEFINITIONS as DefinitionNode[]),
    ];

    this.definitions.forEach(definition => {
      // We'll leave extensions there in case they need to be supported by
      // GraphQL in the future.
      if (definition.kind === 'ObjectTypeDefinition') {
        definitions.push(
          this.extensionMap.getFinalDefinition(definition.name.value),
        );
      } else {
        definitions.push(definition);
      }
    });

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
    createConnectionResolver,
  };
}

function handleDirectives(
  object: IBlossomInstance,
  node: DefinitionNode & { directives?: readonly DirectiveNode[] },
) {
  if (!node.directives || node.directives.length === 0) {
    return;
  }

  node.directives.forEach(directive => {
    const handler = object.runtimeDirectiveHandler.get(directive.name.value);
    if (!handler) {
      return;
    }

    handler(object, node, directive);
  });
}
