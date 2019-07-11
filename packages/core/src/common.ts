/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  GraphQLResolveInfo,
  GraphQLError,
  DocumentNode,
  GraphQLSchema,
  OperationTypeNode,
  DefinitionNode,
  DirectiveNode,
} from 'graphql';

import { BlossomError } from './errors';

/**
 * Maybe the expected value, otherwise null or undefined.
 */
export type Maybe<T> = T | null | undefined;

/**
 * A promise that resolves to Maybe<T>.
 */
export type MaybePromise<T> = Promise<Maybe<T>>;

/**
 * Base signature of a resolving function.
 */
export type BaseResolverSignature<I, O, C> = (args: I, ctx: C, ast: GraphQLResolveInfo) => O;

/**
 * Signature of field resolver.
 */
export type ObjectResolverSignature<I, O, C> = BaseResolverSignature<I, O, C>;

/**
 * Signature of a root query resolver.
 */
export type QueryResolverSignature<I, O, C> = BaseResolverSignature<I, O, C>;

/**
 * Signature of a root mutation resolver.
 */
export type MutationResolverSignature<I, O, C> = BaseResolverSignature<I, O, C>;

/**
 * Signature of a resolver function. Notice the similarity with the root query
 * and mutation signatures! In all fairness, they are different only because
 * we treat them differently.
 */
export type Resolver<I, O, C> = BaseResolverSignature<I, O, C>;

/**
 * Signature of the batch function.
 */
export type BatchFunction<I, O, C> = (ids: ReadonlyArray<I>, ctx: C) => Promise<O[]>;

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
export type ErrorHandlingFunction = <E extends Error>(error: E) => ErrorHandlerOutput;

/**
 * Dict that associates error class to error handler.
 */
export type BlossomErrorHandlerDict = Map<Function, ErrorHandlingFunction>;

export interface IBlossomInstance {
  runtimeDirectiveHandler: Map<string, BootDirectiveHandler>;
  errorHandlers: BlossomErrorHandlerDict;
  addDocument: (document: DocumentNode) => void;
  finalDocument: DocumentNode;
  rootSchema: GraphQLSchema;
  addRootOperation: (
    operation: OperationTypeNode,
    name: string,
    callback: ResolverSignature,
  ) => void;
  addDefinition: (definition: DefinitionNode) => void;
  rootValue: RootValueOutput;
  addErrorHandler: (errorClass: BlossomError, handlingFunction?: ErrorHandlingFunction) => void;
}

export type BootDirectiveHandler = (
  object: IBlossomInstance,
  node: DefinitionNode,
  directive: DirectiveNode,
) => void;
