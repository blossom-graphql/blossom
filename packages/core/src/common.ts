/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { GraphQLResolveInfo } from 'graphql';

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
export type BaseResolverSignature<I, O, C> = (
  args: I,
  ctx: C,
  ast: GraphQLResolveInfo,
) => O;

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
export type BatchFunction<I, O, C> = (
  ids: I[],
  ctx: C,
) => Promise<ReadonlyArray<O>>;
