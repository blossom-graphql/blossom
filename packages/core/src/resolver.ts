/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { GraphQLResolveInfo } from 'graphql';

import { Maybe, Resolver } from './common';
import { ConnectionData, ConnectionPageInfo } from './connections';

export type Connection<O, C> = {
  __typename: string;
  edges: (
    args: {},
    ctx: C,
    ast: GraphQLResolveInfo,
  ) => Promise<
    ReadonlyArray<{
      node: (args: {}, ctx: C, ast: GraphQLResolveInfo) => O;
      cursor: (args: {}, ctx: C, ast: GraphQLResolveInfo) => string;
    }>
  >;
  pageInfo: ConnectionPageInfo<C>;
};

export function createConnectionResolver<I, O, C>(
  typename: string,
  resolver: Resolver<I, O, C>,
): Resolver<ConnectionData<I, C>, Connection<O, C>, C> {
  return function connectionResolver(
    attributes: ConnectionData<I, C>,
  ): Connection<O, C> {
    return {
      __typename: `${typename}Connection`,
      async edges(args: {}, ctx: C, ast: GraphQLResolveInfo) {
        const edges = await attributes.edges(args, ctx, ast);

        return edges.map(edge => ({
          node: (_args: {}, ctx: C, ast: GraphQLResolveInfo) =>
            resolve({ data: edge.node, ctx, ast, using: resolver }),
          cursor: edge.cursor,
        }));
      },
      pageInfo: attributes.pageInfo,
    };
  };
}

export function resolveArray<I, O, C>(resolveParams: {
  data: ReadonlyArray<null | undefined>;
  ctx: C;
  ast: GraphQLResolveInfo;
  using: Resolver<I, O, C>;
}): ReadonlyArray<null>;
export function resolveArray<I, O, C>(resolveParams: {
  data: ReadonlyArray<I>;
  ctx: C;
  ast: GraphQLResolveInfo;
  using: Resolver<I, O, C>;
}): ReadonlyArray<O>;
export function resolveArray<I, O, C>(resolveParams: {
  data: ReadonlyArray<Maybe<I>>;
  ctx: C;
  ast: GraphQLResolveInfo;
  using: Resolver<I, O, C>;
}): ReadonlyArray<O | null>;
export function resolveArray<I, O, C>(resolveParams: {
  data: ReadonlyArray<Maybe<I>>;
  ctx: C;
  ast: GraphQLResolveInfo;
  using: Resolver<I, O, C>;
}): ReadonlyArray<O | null> {
  const { data, ctx, ast, using: callback } = resolveParams;

  const result = data.map(el => {
    if (el === null || el === undefined) return null;

    return callback(el, ctx, ast);
  });

  return result;
}

export function resolve<I, O, C>(resolveParams: {
  data: null | undefined;
  ctx: C;
  ast: GraphQLResolveInfo;
  using: Resolver<I, O, C>;
}): Readonly<null>;
export function resolve<I, O, C>(resolveParams: {
  data: Readonly<I>;
  ctx: C;
  ast: GraphQLResolveInfo;
  using: Resolver<I, O, C>;
}): Readonly<O>;
export function resolve<I, O, C>(resolveParams: {
  data: Readonly<Maybe<I>>;
  ctx: C;
  ast: GraphQLResolveInfo;
  using: Resolver<I, O, C>;
}): Readonly<O | null> {
  const { data, ctx, ast, using: callback } = resolveParams;

  if (data === null || data === undefined) {
    return null;
  }

  return callback(data, ctx, ast);
}
