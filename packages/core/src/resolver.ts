/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { RPCCallback } from './schema';

// ==================================================================
// BASE TYPES
// ==================================================================

/**
 * A resolver base function, accepting input attributes and context, and
 * returning output with the additional typename.
 */
type ResolverBase<I, O> = (input: I, context?: any) => O;

/**
 * A resolver function, accepting input attributes and context, and
 * returning output with the additional typename.
 */
type Resolver<I, O> = (input: I, context?: any) => ResolverOutputItem<O>;

/**
 * Configuration required by the resolver function.
 */
interface ResolverConfig<I, O> {
  /**
   * Attributes passed to be mapped to a resolver output.
   */
  attributes: I | I[] | null | undefined;

  /**
   * Resolver to be used.
   */
  using: Resolver<I, O>;

  /**
   * Context used to resolve the call. This is the object where
   * you should provide information about a possible HTTP request
   * or user permissions.
   */
  context?: any;
}

/**
 * Additional parameters used to make a resolver output.
 */
interface ResolvedOutputItemBase {
  __typename: string;
}

/**
 * Output of a resolver includes the user-defined type and
 * the __typename key.
 */
export type ResolverOutputItem<O> =
  | (O & ResolvedOutputItemBase)
  | null
  | undefined;

/**
 * Possible outputs of the resolver, a resolver output type itself
 * or an array of them.
 */
export type ResolverOutput<O> =
  | ResolverOutputItem<O>
  | ResolverOutputItem<O>[]
  | Connection<O>;

// ==================================================================
// CONNECTION TYPES
// ==================================================================

/**
 * Page info element of a connection.
 */
interface ConnectionPageInfo {
  /**
   * Total elements available con the connection. This is
   * a thunk that will be called by the resolver **on demand**.
   */
  count: () => PromiseLike<Number>;
  /**
   * Has the connection a next page? Thunked.
   */
  hasNextPage: () => PromiseLike<boolean>;
  /**
   * Has the connection a previous page? Thunked.
   */
  hasPreviousPage: () => PromiseLike<boolean>;
}

/**
 * The representation of a single edge item.
 */
interface ConnectionEdge<T> {
  /**
   * Node contents of the connection.
   */
  node: () => T;
  /**
   * Cursor of the connection. This is a thunked version,
   * called on demand.
   */
  cursor: () => string;
}

/**
 * Array of edges of the connection. This is an allias and has a promise
 * like thunked version to lazily load the information.
 */
type ConnectionEdges<T> = RPCCallback<PromiseLike<ConnectionEdge<T>[]>>;

/**
 * Represents the basic elements a connection requires: edges and pageInfo.
 */
interface ConnectionBase<T> {
  /**
   * Edges of the connection.
   */
  edges: ConnectionEdges<T>;
  /**
   * Page information of the connection.
   */
  pageInfo: ConnectionPageInfo;
}

/**
 * Additional elements required in a connection.
 */
export interface ConnectionDecorator {
  __typename: string;
}

/**
 * A full connection is the base and the decorator.
 */
export type Connection<T> = ConnectionBase<T> & ConnectionDecorator;

/**
 * Connection resolver
 */
type ConnectionResolver<I, O> = (
  attributes: ConnectionBase<I>,
  context?: any,
) => Connection<O>;

// ==================================================================
// BASE FUNCTIONS
// ==================================================================

/**
 * Creates a resolver from an input -> output mapping.
 *
 * @param resolver Resolver base function to convert to a resolver.
 *
 * @param typename Typename the resolver will be returning.
 */
export function createResolver<I, O>(
  typename: string,
  resolver: ResolverBase<I, O>,
): Resolver<I, O> {
  return (input: I, context?: any) => {
    const resolved = <O>resolver(input, context);

    return Object.assign({ __typename: typename }, resolved);
  };
}

/**
 * Given a resolver, creates the resolver for a connection of that
 * family of schemas.
 *
 * @param resolver Resolver function to convert.
 *
 * @param typename Typename of the resolver. This will return
 * `<typename>+Connection`.
 */
export function createConnectionResolver<I, O>(
  typename: string,
  resolver: Resolver<I, O>,
): ConnectionResolver<I, O> {
  // The final resolver function to compose
  return (attributes: ConnectionBase<I>, context?: any): Connection<O> => ({
    // Pass the new typename from the base function
    __typename: `${typename}Connection`,
    // Here's the tricky part. For each edge we pass the cursor
    // as it comes from the input. However, we need to map each node and
    // pass it through the resolver. Moreover, this must be made
    // on demand to have it thunked.
    async edges(): Promise<ConnectionEdge<O>[]> {
      // Wait for the edges. Note that this happens only when
      // the function is called.
      const edges = await attributes.edges(null, context);

      // Map each single edge and pass it through the resolver.
      return (
        edges &&
        edges.map(edge => ({
          node() {
            // If we are on a paginated result the simplest (and most expected)
            // outcome is that the data is always defined on the pages that are
            // being shown.
            return resolver(edge.node(), context) as O;
          },
          cursor: edge.cursor,
        }))
      );
    },
    // Page info is inherited as is
    pageInfo: attributes.pageInfo,
  });
}

/**
 * Takes attributes and resolves them using the provided resolver and context.
 *
 * @param config Configuration for obtaining this particular resolver value.
 */
export function resolve<I, O>(
  config: ResolverConfig<I, O>,
): ResolverOutput<O> | null {
  const { attributes, using: resolver, context } = config;

  // If null, don't even bother to do anything.
  if (!attributes) {
    return null;
  } else if (Array.isArray(attributes)) {
    // On array, perform a map operation over every resolved
    // item.
    return attributes.map(attr => resolver(attr, context));
  } else {
    // If it's just an object, them perform the resolving with
    // the context.
    return resolver(attributes, context);
  }
}
