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

export type SequelizeModel<U extends Model> = (new () => U) & typeof Model;

export type SequelizeConnectionArgsMapper<F, D, C> = (
  input: AdapterBaseInput<F, D>,
  ctx: C,
) => { where: WhereOptions; include?: Includeable[] };

const AnchorToOp: Map<AdapterAnchorType, symbol> = new Map([
  [AdapterAnchorType.GT, Op.gt],
  [AdapterAnchorType.LT, Op.lt],
  [AdapterAnchorType.GTE, Op.gte],
  [AdapterAnchorType.LTE, Op.lte],
]);

function defaultCursorGenerator<U, C>(
  entity: U,
  key: keyof U,
  _ctx: C,
): string {
  return String(entity[key]);
}

export type AdapterOptions<C> = {
  cursor: typeof defaultCursorGenerator;
  limit: number | ((ctx: C) => number);
  default: number | ((ctx: C) => number);
};

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
