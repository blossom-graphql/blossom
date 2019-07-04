/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  connectionDataLoader,
  ConnectionAdapter,
  AdapterAnchorType,
  LoadOrder,
} from '../connections';
import { GraphQLResolveInfo } from 'graphql';

type ExampleFilter = {
  fruits?: string[];
};

type ExampleData = {
  id: number;
  fruit: string;
};

const SAMPLE_DATA: readonly ExampleData[] = [
  {
    id: 1,
    fruit: 'orange',
  },
  {
    id: 2,
    fruit: 'mango',
  },
  {
    id: 3,
    fruit: 'pineapple',
  },
  {
    id: 4,
    fruit: 'peach',
  },
  {
    id: 5,
    fruit: 'pear',
  },
  {
    id: 6,
    fruit: 'apple',
  },
  {
    id: 7,
    fruit: 'strawberry',
  },
  {
    id: 8,
    fruit: 'raspberry',
  },
  {
    id: 9,
    fruit: 'papaya',
  },
  {
    id: 10,
    fruit: 'cherimoya',
  },
  {
    id: 11,
    fruit: 'macadamia',
  },
  {
    id: 12,
    fruit: 'cherry',
  },
];

const RESOLVE_INFO = {} as GraphQLResolveInfo;

/**
 * Mock adapter used to fetch data from `SAMPLE_DATA`.
 */
const AdapterMock: ConnectionAdapter<ExampleFilter, ExampleData, any> = {
  limit() {
    return 10;
  },
  default() {
    return 5;
  },
  async load(args) {
    const count = args.max;
    const filters: ((i: number) => boolean)[] = [];

    args.anchors.forEach(anchor => {
      if (anchor.type === AdapterAnchorType.GT) {
        filters.push(n => n > parseInt(anchor.cursor, 10));
      }

      if (anchor.type === AdapterAnchorType.LT) {
        filters.push(n => n < parseInt(anchor.cursor, 10));
      }
    });

    const filter = (i: number): boolean =>
      filters.reduce((acc, f) => acc && f(i), true as boolean);

    let slice: ExampleData[] = SAMPLE_DATA.filter(datum =>
      filter(datum.id),
    ).slice(0, count);
    if (args.filter.fruits && args.filter.fruits.length > 0) {
      slice = SAMPLE_DATA.filter(
        datum => args.filter.fruits && args.filter.fruits.includes(datum.fruit),
      );
    }
    if (args.order === LoadOrder.DESC) {
      slice.reverse();
    }

    return slice.map(datum => ({
      node: datum,
      cursor: () => datum.id.toString(),
    }));
  },
  async count(args) {
    if (args.filter.fruits && args.filter.fruits.length > 0) {
      return SAMPLE_DATA.filter(
        datum => args.filter.fruits && args.filter.fruits.includes(datum.fruit),
      ).length;
    }

    return SAMPLE_DATA.length;
  },
};

// Yes, we test the mock first, to ensure that it's behaving as expected. This way,
// we can ensure that wrong test results are actually caused by broken code and not
// by issues with the mock itself.
describe('AdapterMock', () => {
  describe('limit', () => {
    test('returns the correct value', () => {
      expect(AdapterMock.limit({})).toBe(10);
    });
  });

  describe('default', () => {
    test('returns the correct value', () => {
      expect(AdapterMock.default({})).toBe(5);
    });
  });

  describe('count', () => {
    describe('when no filters are applied', () => {
      test('returns the correct value', async () => {
        expect.assertions(1);
        expect(await AdapterMock.count({ filter: {} }, {})).toBe(
          SAMPLE_DATA.length,
        );
      });
    });

    describe('when a filter is applied', () => {
      test('returns the correct value', async () => {
        expect.assertions(1);
        expect(
          await AdapterMock.count(
            { filter: { fruits: ['pineapple', 'cherimoya'] } },
            {},
          ),
        ).toBe(2);
      });
    });
  });

  describe('load', () => {
    describe('when no filters are applied', () => {
      test('returns the correct values', async () => {
        expect.assertions(10);
        const data = await AdapterMock.load(
          {
            filter: {},
            primary: 'id',
            fields: ['id', 'fruit'],
            max: 5,
            order: LoadOrder.ASC,
            anchors: [],
          },
          {},
        );

        data.forEach((datum, i) => {
          expect(datum.node).toEqual(SAMPLE_DATA[i]);
          expect(datum.cursor()).toEqual(String(SAMPLE_DATA[i].id));
        });
      });
    });

    describe('when the sorting order is different', () => {
      test('it returns the correct number of elements', async () => {
        expect.assertions(10);
        const data = await AdapterMock.load(
          {
            filter: {},
            primary: 'id',
            fields: ['id', 'fruit'],
            max: 5,
            order: LoadOrder.DESC,
            anchors: [],
          },
          {},
        );

        data
          .slice()
          .reverse()
          .forEach((datum, i) => {
            expect(datum.node).toEqual(SAMPLE_DATA[i]);
            expect(datum.cursor()).toEqual(String(SAMPLE_DATA[i].id));
          });
      });
    });

    describe('when there is a lower anchor bound', () => {
      test('it returns the correct values', async () => {
        expect.assertions(11);
        const data = await AdapterMock.load(
          {
            filter: {},
            primary: 'id',
            fields: ['id', 'fruit'],
            max: 8,
            order: LoadOrder.ASC,
            anchors: [
              {
                type: AdapterAnchorType.LT,
                cursor: '6',
              },
            ],
          },
          {},
        );

        expect(data.length).toEqual(5); // id starts in 1!
        data.slice().forEach((datum, i) => {
          expect(datum.node).toEqual(SAMPLE_DATA[i]);
          expect(datum.cursor()).toEqual(String(SAMPLE_DATA[i].id));
        });
      });
    });

    describe('when there is an upper anchor bound', () => {
      test('it returns the correct values', async () => {
        expect.assertions(7);
        const data = await AdapterMock.load(
          {
            filter: {},
            primary: 'id',
            fields: ['id', 'fruit'],
            max: 3,
            order: LoadOrder.ASC,
            anchors: [
              {
                type: AdapterAnchorType.GT,
                cursor: '4',
              },
            ],
          },
          {},
        );

        expect(data.length).toEqual(3);
        data.slice().forEach((datum, i) => {
          expect(datum.node).toEqual(SAMPLE_DATA[4 + i]); // id 5 is index 4
          expect(datum.cursor()).toEqual(String(SAMPLE_DATA[4 + i].id));
        });
      });
    });
  });
});

describe(connectionDataLoader, () => {
  const loader = connectionDataLoader(AdapterMock);

  describe('with happy path parameters', () => {
    test('it returns correct values', async () => {
      expect.assertions(14);

      const result = loader(
        {},
        {
          primary: 'id',
          order: LoadOrder.ASC,
        },
        RESOLVE_INFO,
      );
      const edges = await result.edges({}, {}, RESOLVE_INFO);

      expect(edges.length).toBe(AdapterMock.default({}));

      edges.forEach((edge, i) => {
        expect(edge.node).toEqual(SAMPLE_DATA[i]);
        expect(edge.cursor({}, {}, RESOLVE_INFO)).toEqual(
          SAMPLE_DATA[i].id.toString(),
        );
      });

      expect(await result.pageInfo.count({}, {}, RESOLVE_INFO)).toBe(
        SAMPLE_DATA.length,
      );
      expect(await result.pageInfo.hasNextPage({}, {}, RESOLVE_INFO)).toBe(
        true,
      );
      expect(await result.pageInfo.hasPreviousPage({}, {}, RESOLVE_INFO)).toBe(
        false,
      );
    });
  });
});
