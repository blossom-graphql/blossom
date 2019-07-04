import { GraphQLResolveInfo } from 'graphql';
import Dataloader from 'dataloader';

// Generics guide:
// - `F` represents the type of the filter in a connection operation.
// - `D` represents the type of the base data.
// - `C` represents the type of the context.

class ConnectionArgsError extends Error {
  constructor(error: string) {
    super(`Invalid connection arguments: ${error}`)
  }
}

/**
 * Represents the arguments that are usually passed from a GraphQL request in
 * order to fetch a connection. These are the input arguments when the output
 * of `connectionDataLoader()` is invoked from a root function.
 */
export type ConnectionArgs<D> = {
  /**
   * List of the fields that are going to be fetched in this request. They
   * **must** be `string` fields of `D`, but this field might not be necessarily
   * present.
   */
  fields?: (keyof D)[];
  /**
   * The numbers of elements that must be fetched for this connection. Usually
   * used in conjuntion with `after`.
   */
  first?: number;
  /**
   * The number of elements that must be fetched for this connection. Usually
   * used in conjuntion with `before`.
   */
  last?: number;
  /**
   * Cursor indicanting an anchor from which to start fetching elements. It's
   * associated with the notion of *smaller than*, relative to the cursor in
   * **the page** (not in the data source).
   */
  before?: string;
  /**
   * Cursor indicanting an anchor from which to start fetching elements. It's
   * associated with the notion of *greater than*, relative to the cursor in
   * **the page** (not in the data source).
   */
  after?: string;
  /**
   * Field from `D` that is going to be used as the primary key for fetching
   * the information. It **has** to be a `string` key available in `D`, since
   * it's going to be used to encode/decode the cursors as well.
   */
  primary: keyof D;
  order: LoadOrder;
};

/**
 * Pagination information about a connection data result.
 */
export type ConnectionPageInfo<C> = {
  /**
   * Estimated amount of items, or upper bound about the total results the
   * page might have. This matches the signature of any GraphQL function
   * just for type safety, but the arguments won't actually be used in practice.
   */
  count: (args: {}, ctx: C, ast: GraphQLResolveInfo) => Promise<number>;
  /**
   * Has the item a previous page? This matches the signature of any GraphQL
   * function just for type safety, but the arguments won't actually be used in
   * practice.
   */
  hasPreviousPage: (
    args: {},
    ctx: C,
    ast: GraphQLResolveInfo,
  ) => Promise<boolean>;
  /**
   * Has the item a next page? This matches the signature of any GraphQL
   * function just for type safety, but the arguments won't actually be used in
   * practice.
   */
  hasNextPage: (args: {}, ctx: C, ast: GraphQLResolveInfo) => Promise<boolean>;
};

/**
 * A function that, when invoked in a GraphQL request, returns the value of
 * the cursor for an edge. This matches the signature of any GraphQL function
 * just for type safety, but the arguments won't actually be used in practice.
 */
export type ConnectionCursor<C> = (
  /**
   * Arguments to the function. The Relay specification does not consider
   * any arguments by default.
   */
  args: {},
  /**
   * Value of the context for this request.
   */
  ctx: C,
  /**
   * Information about the current AST on this part of the query.
   */
  ast: GraphQLResolveInfo,
) => string;

/**
 * Data structure that contains a Relay compliant description of the elements
 * of a page result. The entire set of results for a query can be seen as an
 * acyclic directed graph. A result that shows a fraction of the results of
 * such graph plus the elements on the vertices is called a **connection**.
 */
export type ConnectionData<D, C> = {
  /**
   * The subset of the graph represented by this connection, containing both the
   * elements (the `nodes`) and the unique identifier of each one of this for
   * this graph (the `cursor`).
   */
  edges: (
    args: {},
    ctx: C,
    ast: GraphQLResolveInfo,
  ) => Promise<
    readonly {
      node: D;
      cursor: ConnectionCursor<C>;
    }[]
  >;
  /**
   * Information about the position of this connection in the entire results
   * set: is it positioned in one of the extrema? How many elements are in the
   * graph?
   */
  pageInfo: ConnectionPageInfo<C>;
};

export type ConnectionAdapter<F, D, C> = {
  /**
   * Maximum numbers of items per page that can be fetched.
   */
  limit: (context: C) => number;

  /**
   * Default numbers of items per page that are fetched if nothing's specified.
   */
  default: (context: C) => number;

  /**
   * Given specific paratmeters, as specified in `AdapterLoadInput`, should
   * return a list of records that match the criteria. These are going to
   * be used to populate `edges`, `hasNextPage` and `hasPreviousPage`.
   */
  load: (
    args: AdapterLoadInput<F, D>,
    context: C,
  ) => Promise<ReadonlyArray<ConnectionEdge<D>>>;

  /**
   * Given a certain criteria, it should return the **maximum** number of
   * elememnts that is going to be possible to find for it. In practice,
   * the actual number of available elements is going to be determined by
   * the values of `hasNextPage` and `hasPreviousPage` in `ConnectionData`,
   * which in turn invoke `load` with specific parameters.
   */
  count: (args: AdapterCountInput<F>, context: C) => Promise<number>;
};

/**
 * One of the edges of a connection result given as a response by `load()`.
 */
export type ConnectionEdge<D> = {
  /**
   * The actual entity with the significant information.
   */
  node: D;
  /**
   * The value of the cursor for this edge. When invoked, must return the
   * unique string cursor.
   */
  cursor: () => string;
};

/**
 * Order in which items should be loaded.
 */
export enum LoadOrder {
  /**
   * Ascending.
   */
  ASC = 'ASC',
  /**
   * Descending.
   */
  DESC = 'DESC',
}

/**
 * Common input for any of the thunked operations: either `load()` or `count()`. 
 */
type AdapterInput<F> = {
  /**
   * An object that describes the possible values that the filter for this
   * adapter might accept.
   */
  filter: F;
};

/**
 * Arguments passed to the `count()` function in order to fetch the estimated
 * list of total entries.
 */
export type AdapterCountInput<F> = AdapterInput<F>;

/**
 * One of the possible anchor types used to perform a query within the adapter.
 */
export enum AdapterAnchorType {
  /**
   * Greater than.
   */
  GT = 'GT',
  /**
   * Greater than or equal to.
   */
  GTE = 'GTE',
  /**
   * Less than.
   */
  LT = 'LT',
  /**
   * Less than or equal to.
   */
  LTE = 'LTE',
}

/**
 * The description of an anchor when fetching data from the connection. This must
 * be either a string
 */
export type AdapterAnchor = {
  /**
   * Type for the anchor, describing the order.
   */
  type: AdapterAnchorType;
  /**
   * Cursor associated to this anchor. Always a string.
   */
  cursor: string;
};

/**
 * Arguments passed to the `load()` function in order to fetch the entries.
 */
export type AdapterLoadInput<F, D> = AdapterInput<F> & {
  /**
   * Name of the primary field. It's the field that is going to be used to
   * generate the cursor as well. Do **NOT** confuse this with the primary field
   * of a database. For a pagination based on the `createdAt` field, this would
   * be the primary in the adapter and **NOT** the `id` field.
   */
  primary: keyof D;

  /**
   * Max number of items asked in the request. The `load()` function must return
   * **at most** `max` fields but does not need to guarantee returning such
   * number of fields.
   */
  max: number;

  /**
   * Order in which results should be returned for the primary.
   */
  order: LoadOrder;

  /**
   * List of attributes that **at least** must be provided by the corresponding
   * function. Ideally, the `load()` function should return and query exactly
   * the fields asked.
   */
  fields: (keyof D)[];

  /**
   * List of **anchors** for this request. *Anchors* are a list of pointers that
   * indicate the subset of the results graph that needs to be fetched. As an
   * example, this data structure is telling the `load()` function: "give me
   * the results that are greater than this cursor and/or smaller than this
   * cursor". It's up to the loader then to properly handle this and convert
   * it to the correct query DSL.
   */
  anchors: readonly AdapterAnchor[];
};

/**
 * A function that retrieves the `ConnectionArgs<D>` and the context `C` from
 * a GraphQL request and returns a result that then can be parsed by the GraphQL
 * engine to subsequently fetch additional information.
 */
export type ConnectionDataLoader<F, D, C> = (
  /**
   * Filter with the information that needs to be fetched.
   */
  filter: F,
  /**
   * Common arguments in a connection.
   */
  connectionArgs: ConnectionArgs<D>,
  /**
   * Context of the incoming GraphQL request.
   */
  ctx: C,
) => ConnectionData<D, C>;

/**
 * Given an `adapter`, returns a function that can be used to fetch connection
 * data for a GraphQL root query request.
 * 
 * @param adapter Adapter function to use on this operation. Usually comes from
 * one of the adapters packages and is a function that returns the adapter itself.
 */
export function connectionDataLoader<F, D, C>(
  adapter: ConnectionAdapter<F, D, C>,
): ConnectionDataLoader<F, D, C> {
  return function load(filter: F, connectionArgs: ConnectionArgs<D>, ctx: C) {
    const { anchors, limit, order } = computeOrientation(
      adapter,
      connectionArgs,
      ctx,
    );

    /**
     * So, what does this trick do? Notice that this loader we are creating is
     * going to be used by `edges`, `hasPreviousPage` and `hasNextPage`. If both
     * are called in parallel, then the contents of the function inside will
     * only be executed once and cached in the subsequent request. Instead of doing hard
     * coordination with mutexes and atomic operations, we can leverage the use
     * of DataLoader, which is already designed to deal with this by having
     * fun with the event loop.
     */
    const resultsLoader = new Dataloader(async (ids: number[]) => {
      const results = await adapter.load(
        {
          filter,
          fields: connectionArgs.fields || [],
          anchors,
          order,
          max: limit,
          primary: connectionArgs.primary,
        },
        ctx,
      );

      return ids.map(_id => results);
    });

    const hasVertex = async (anchorType: AdapterAnchorType): Promise<boolean> => {
      const results = await resultsLoader.load(0);
      if (results.length == 0) return false;

      const cursor = results[results.length - 1].cursor();
      const nextResults = await adapter.load(
        {
          filter,
          fields: [connectionArgs.primary], // we do we need more than the primary?
          anchors: [
            {
              type: adaptAnchorType(
                anchorType,
                connectionArgs.order,
              ),
              cursor,
            },
          ],
          order: connectionArgs.order,
          max: 1,
          primary: connectionArgs.primary,
        },
        ctx,
      );
      return nextResults.length > 0;
    }

    return {
      async edges(_args: {}, _ctx: C, _ast: GraphQLResolveInfo) {
        const results = await resultsLoader.load(0);

        // If the orders are different, this means we need to reverse the order
        // at which the results are coming from the database.
        if (order === connectionArgs.order) {
          return results;
        } else {
          // Reverse by itself is immutable, so unfortunately we need to copy
          // it first.
          return results.slice().reverse();
        }
      },
      pageInfo: {
        count() {
          return adapter.count({ filter }, ctx);
        },
        hasNextPage(): Promise<boolean> {
          return hasVertex(AdapterAnchorType.GT)
        },
        hasPreviousPage(): Promise<boolean> {
          return hasVertex(AdapterAnchorType.LT)
        }
      },
    };
  };
}

/**
 * Given an adapter, the arguments and the context, returns the value of the
 * `limit` (max numbers to fetch), the list of `anchors` to involve in the
 * operation, and the sorting `order` that the **data store** must use to
 * fetch the information (as opposed to the order in the page).
 * 
 * @param adapter Adapter structure.
 * @param connectionArgs Common arguments of the GraphQL request.
 * @param ctx Parameters of the incoming GraphQL request.
 */
function computeOrientation<F, D, C>(
  adapter: ConnectionAdapter<F, D, C>,
  connectionArgs: ConnectionArgs<D>,
  ctx: C,
): { limit: number, anchors: readonly AdapterAnchor[], order: LoadOrder } {
  // The gql request is asking for both first and last at the same time.
  // This is not supported.
  if (!!connectionArgs.first && !!connectionArgs.last) {
    throw new ConnectionArgsError(
      "'first' and 'last' keys are not supported at the same time",
    );
  }

  const anchors: AdapterAnchor[] = [];
  let limit = adapter.default(ctx);

  // When we are fetching the last `N` elements, we want to ask the data store
  // to fetch the information in reverse order.
  let order = !!connectionArgs.last
    ? invertOrder(connectionArgs.order)
    : connectionArgs.order;

  if (!!connectionArgs.first) {
    limit = Math.min(connectionArgs.first, adapter.limit(ctx));
  }

  if (!!connectionArgs.last) {
    limit = Math.min(connectionArgs.last, adapter.limit(ctx));
  }

  if (!!connectionArgs.after) {
    anchors.push({
      type: adaptAnchorType(AdapterAnchorType.GT, order),
      cursor: connectionArgs.after,
    });
  }

  if (!!connectionArgs.before) {
    anchors.push({
      type: adaptAnchorType(AdapterAnchorType.LT, order),
      cursor: connectionArgs.before,
    });
  }

  return {
    limit,
    anchors,
    order,
  };
}

/**
 * Inverts the order of the enum. `ASC -> DESC` and vice-versa.
 * @param order `LoadOrder` value to invert.
 */
function invertOrder(order: LoadOrder): LoadOrder {
  switch (order) {
    case LoadOrder.ASC:
      return LoadOrder.DESC;
    case LoadOrder.DESC:
      return LoadOrder.ASC;
  }
}

/**
 * Given the current page order and the type of anchor, returns the adapted
 * anchor type to how it should be fetched from the data store.
 * 
 * @param anchorType Type of anchor that needs to be adapted.
 * @param order Current expected ordering for **the page.**
 */
function adaptAnchorType(
  anchorType: AdapterAnchorType,
  order: LoadOrder,
): AdapterAnchorType {
  switch (anchorType) {
    case AdapterAnchorType.GT:
      return order === LoadOrder.ASC
        ? AdapterAnchorType.GT
        : AdapterAnchorType.LT;
    case AdapterAnchorType.LT:
      return order === LoadOrder.ASC
        ? AdapterAnchorType.LT
        : AdapterAnchorType.GT;
    case AdapterAnchorType.GTE:
      return order === LoadOrder.ASC
        ? AdapterAnchorType.GTE
        : AdapterAnchorType.LTE;
    case AdapterAnchorType.LTE:
      return order === LoadOrder.ASC
        ? AdapterAnchorType.LTE
        : AdapterAnchorType.GTE;
  }
}
