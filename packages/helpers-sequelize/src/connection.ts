/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  ConnectionAdapter,
  AdapterBaseInput,
  AdapterAnchorType,
  LoadOrder,
} from '@blossom-gql/core';
import set from 'lodash.set';
import { Model, Op, WhereOptions, Includeable } from 'sequelize';

/**
 * Maps all the values from `AdapterAnchorType` to a `sequelize.Op` symbol
 * comparison operator. This is used for mapping the anchors to the actually
 * query operations within the `findAll` method.
 */
const AnchorToOp: Map<AdapterAnchorType, symbol> = new Map([
  [AdapterAnchorType.GT, Op.gt],
  [AdapterAnchorType.LT, Op.lt],
  [AdapterAnchorType.GTE, Op.gte],
  [AdapterAnchorType.LTE, Op.lte],
]);

/**
 * A representation of the sequelize `Model` class (as opposed to the instance).
 * For our adapters here we are concerned about the constructor and not an
 * instance, which is actually not available at this point.
 */
export type SequelizeModel<U extends Model> = (new () => U) & typeof Model;

/**
 * A function that receives the base input of an adapter (i.e. the `filter` and
 * the `primary`) and returns the values of `where` and `include`, to be used
 * in the model's `findAll` and `count` methods.
 */
export type SequelizeConnectionArgsMapper<F, D, C> = (
  input: AdapterBaseInput<F, D>,
  ctx: C,
) => { where: WhereOptions; include?: Includeable[] };

/**
 * The default function used to generate a cursor from a Sequelize entity.
 *
 * @param entity An **instance** of `Model`.
 * @param key The key that is going to be used to generate the cursor.
 * @param _ctx The context of the GraphQL request, if required.
 */
function defaultCursorGenerator<U extends Model, C>(
  entity: U,
  key: keyof U,
  _ctx: C,
): string {
  return String(entity[key]);
}

/**
 * Multiple options that can be passed to the adapter generator. All of them
 * are optional and come with reasonable defaults.
 */
export type AdapterOptions<C> = {
  /**
   * Function that maps the instance of `sequelize.Model` and/or one of their
   * fields to a unique `string` identifier.
   */
  cursor: typeof defaultCursorGenerator;
  /**
   * Either a number of a function that receives the GraphQL request context
   * and returns the maximum number of items that can be fetched in this
   * adapter.
   */
  limit: number | ((ctx: C) => number);
  /**
   * Either a number of a function that receives the GraphQL request context
   * and returns the default number of items that are fetched on a request when
   * nothing is specified.
   */
  default: number | ((ctx: C) => number);
};

/**
 * Generates a `ConnectionAdapter` that allows querying connections from
 * `sequelize`. This in turn can be passed to the `connectionDataLoader`
 * function from `@blossom-gql/core`.
 *
 * @param m `Model` **constructor**. Directly reference without instancing.
 * @param argsMapper Function that receives the base arguments and returns the
 * `where` and `include` statements that must be passed to the `findAll` and
 * `count` functions in Sequelize.
 * @param opts Optional hash of options that sets up the behavior for
 * pagination and cursor serialization.
 */
export function sequelizeConnectionAdapter<
  F,
  U extends Model,
  M extends SequelizeModel<U>,
  C
>(
  m: M,
  argsMapper: SequelizeConnectionArgsMapper<F, U, C>,
  opts: AdapterOptions<C> = {
    cursor: defaultCursorGenerator,
    default: 20,
    limit: 100,
  },
): ConnectionAdapter<F, U, C> {
  return {
    limit(ctx: C) {
      if (typeof opts.limit === 'number') {
        return opts.limit;
      }
      return opts.limit(ctx);
    },
    default(ctx: C) {
      if (typeof opts.default === 'number') {
        return opts.default;
      }
      return opts.default(ctx);
    },
    async load(args, ctx) {
      const mappedArgs = argsMapper(args, ctx);

      // Ensure that the field labeled as primary is always present in the list
      // of fields.
      const attributes =
        args.fields && args.fields.length > 0
          ? new Set(args.fields).add(args.primary)
          : undefined;

      // Start the `where` and add the anchors to it, if any of them is present.
      const where = { ...mappedArgs.where };
      args.anchors.forEach(anchor => {
        const op = AnchorToOp.get(anchor.type);
        if (!op) {
          // no known anchor, skip. maybe raise an exception?
          return;
        }

        // Add the anchor to the where statement: [primary].[operator] = cursor value
        set(where, [args.primary, op], anchor.cursor);
      });

      const results: readonly U[] = await m.findAll({
        attributes: attributes && ([...attributes] as string[]),
        where,
        include: mappedArgs.include,
        limit: args.max,
        order: [
          [
            args.primary as string,
            args.order === LoadOrder.ASC ? 'ASC' : 'DESC',
          ],
        ],
      });

      return results.map(result => ({
        node: result,
        cursor: () => opts.cursor(result, args.primary, ctx),
      }));
    },
    count(args, ctx) {
      const mappedArgs = argsMapper(args, ctx);

      return m.count({
        where: mappedArgs.where,
        include: mappedArgs.include,
        distinct: true,
        col: args.primary as string,
      });
    },
  };
}
