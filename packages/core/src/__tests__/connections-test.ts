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
  ConnectionArgsError,
  ConnectionArgs,
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
    return 9;
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

    const base = SAMPLE_DATA.slice();
    if (args.order === LoadOrder.DESC) {
      base.reverse();
    }

    let slice: ExampleData[] = base
      .filter(datum => filter(datum.id))
      .slice(0, count); // ! THIS SHOULD GO **AFTER** THE FILTERS.
    if (args.filter.fruits && args.filter.fruits.length > 0) {
      slice = slice.filter(
        datum => args.filter.fruits && args.filter.fruits.includes(datum.fruit),
      );
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
      expect(AdapterMock.limit({})).toBe(9);
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
            expect(datum.node).toEqual(SAMPLE_DATA[7 + i]); // id 8 is index 7
            expect(datum.cursor()).toEqual(String(SAMPLE_DATA[7 + i].id));
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

  describe('both first and last are present', () => {
    test('it raises ConnectionArgsError', () => {
      expect(() => {
        loader(
          {},
          { primary: 'id', order: LoadOrder.ASC, first: 10, last: 10 },
          RESOLVE_INFO,
        );
      }).toThrowError(ConnectionArgsError);
    });
  });

  type ExtectedValues = {
    edges: readonly { node: ExampleData; cursor: string }[];
    count: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  async function expectValues(
    filter: ExampleFilter,
    args: ConnectionArgs<ExampleData>,
    expected: ExtectedValues,
  ) {
    const result = loader(filter, args, RESOLVE_INFO);
    const edges = await result.edges({}, {}, RESOLVE_INFO);
    expect.assertions(4 + 2 * expected.edges.length);

    expect(edges.length).toBe(expected.edges.length);

    edges.forEach((edge, i) => {
      expect(edge.node).toEqual(expected.edges[i].node);
      expect(edge.cursor({}, {}, RESOLVE_INFO)).toEqual(
        expected.edges[i].cursor,
      );
    });

    expect(await result.pageInfo.count({}, {}, RESOLVE_INFO)).toBe(
      expected.count,
    );
    expect(await result.pageInfo.hasNextPage({}, {}, RESOLVE_INFO)).toBe(
      expected.hasNextPage,
    );
    expect(await result.pageInfo.hasPreviousPage({}, {}, RESOLVE_INFO)).toBe(
      expected.hasPreviousPage,
    );
  }

  describe('with happy path parameters', () => {
    test('it returns correct values', async () => {
      await expectValues(
        {},
        {
          primary: 'id',
          order: LoadOrder.ASC,
        },
        {
          edges: SAMPLE_DATA.slice(0, 5).map(data => ({
            node: data,
            cursor: data.id.toString(),
          })),
          count: SAMPLE_DATA.length,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      );
    });
  });

  describe('ascending order', () => {
    describe('first and after present', () => {
      describe('below pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              first: 8,
              after: '2',
            },
            {
              edges: SAMPLE_DATA.slice(2, 10).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('above pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              first: 10,
              after: '2',
            },
            {
              edges: SAMPLE_DATA.slice(2, 11).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('without enough elements (upper bound)', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              after: '10',
            },
            {
              edges: SAMPLE_DATA.slice(10, 12).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: false,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('without enough elements (lower bound)', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              after: '-3',
            },
            {
              edges: SAMPLE_DATA.slice(0, 5).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: false,
            },
          );
        });
      });
    });

    describe('last and before present', () => {
      describe('below pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              last: 8,
              before: '11',
            },
            {
              edges: SAMPLE_DATA.slice(2, 10).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('above pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              last: 10, // it's going to be 9 anyway
              before: '11',
            },
            {
              edges: SAMPLE_DATA.slice(1, 10).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('without enough elements (lower bound)', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              last: 5,
              before: '3',
            },
            {
              edges: SAMPLE_DATA.slice(0, 2).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: false,
            },
          );
        });
      });

      describe('without enough elements (upper bound)', () => {
        test('it returns correct values', async () => {
          // picks 5 anyway: 8, 9, 10, 11, 12
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.ASC,
              last: 5,
              before: '15',
            },
            {
              edges: SAMPLE_DATA.slice(7, 12).map(data => ({
                node: data,
                cursor: data.id.toString(),
              })),
              count: SAMPLE_DATA.length,
              hasNextPage: false,
              hasPreviousPage: true,
            },
          );
        });
      });
    });
  });

  describe('descending order', () => {
    // From the perspective of the page:
    // Ids:       12 - 11 - 10 - ...
    // Position:   1    2 -  3 - ... (as such, after and before mean different things)

    describe('first and after present', () => {
      describe('below pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              first: 8,
              after: '11',
            },
            {
              edges: SAMPLE_DATA.slice(2, 10)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('above pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              first: 10,
              after: '11',
            },
            {
              edges: SAMPLE_DATA.slice(1, 10)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('without enough elements (upper bound)', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              after: '3',
            },
            {
              edges: SAMPLE_DATA.slice(0, 2)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: false,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('without enough elements (lower bound)', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              after: '16',
            },
            {
              edges: SAMPLE_DATA.slice(7, 12)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: false,
            },
          );
        });
      });
    });

    describe('last and before present', () => {
      describe('below pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              last: 8,
              before: '2',
            },
            {
              edges: SAMPLE_DATA.slice(2, 10)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('above pagination limit', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              last: 10, // it's going to be 9 anyway
              before: '2',
            },
            {
              edges: SAMPLE_DATA.slice(2, 11)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: true,
            },
          );
        });
      });

      describe('without enough elements (lower bound)', () => {
        test('it returns correct values', async () => {
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              last: 5,
              before: '9',
            },
            {
              edges: SAMPLE_DATA.slice(9, 12)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: true,
              hasPreviousPage: false,
            },
          );
        });
      });

      describe('without enough elements (upper bound)', () => {
        test('it returns correct values', async () => {
          // picks 5 anyway: 8, 9, 10, 11, 12
          await expectValues(
            {},
            {
              primary: 'id',
              order: LoadOrder.DESC,
              last: 5,
              before: '-3',
            },
            {
              edges: SAMPLE_DATA.slice(0, 5)
                .reverse()
                .map(data => ({
                  node: data,
                  cursor: data.id.toString(),
                })),
              count: SAMPLE_DATA.length,
              hasNextPage: false,
              hasPreviousPage: true,
            },
          );
        });
      });
    });
  });
});
