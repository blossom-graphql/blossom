import { Op } from 'sequelize';

import User, { cleanup, setup } from './fixtures/user';
import {
  sequelizeConnectionAdapter,
  SequelizeConnectionArgsMapper,
  AdapterOptions,
  defaultAdapterOpts,
} from '../connection';
import {
  ConnectionAdapter,
  LoadOrder,
  AdapterAnchorType,
} from '@blossom-gql/core';
import sequelize from './fixtures/sequelize';
import Movie from './fixtures/movie';

beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  if (process.env.SKIP_CLEANUP) {
    await sequelize.close();
  } else {
    await cleanup();
  }
});

describe(sequelizeConnectionAdapter, () => {
  const TEST_DATE = '2018-11-04 09:31:16+00';

  type UsersFilter = {
    firstName?: string;
    lastName?: string;
    createdAt?: Date;
    rating?: number;
  };
  const mapper: SequelizeConnectionArgsMapper<
    UsersFilter,
    User,
    any
  > = args => {
    const firstName = args.filter.firstName
      ? { firstName: { [Op.iLike]: args.filter.firstName } }
      : undefined;

    const createdAt = args.filter.createdAt
      ? { createdAt: { [Op.gte]: args.filter.createdAt } }
      : undefined;

    const rating = args.filter.rating
      ? [
          {
            model: Movie,
            as: 'movies',
            where: { rating: { [Op.gt]: args.filter.rating } },
          },
        ]
      : [];

    return {
      where: { ...firstName, ...createdAt },
      include: [...rating],
    };
  };

  function adapter(
    args?: AdapterOptions<any>,
  ): ConnectionAdapter<UsersFilter, User, any> {
    return sequelizeConnectionAdapter(User, mapper, args);
  }

  describe('limit', () => {
    describe('when a number is set', () => {
      test('it uses the number', () => {
        expect(adapter({ ...defaultAdapterOpts, limit: 5 }).limit({})).toBe(5);
      });
    });

    describe('when a function is set', () => {
      test('it returns the function value', () => {
        expect(
          adapter({ ...defaultAdapterOpts, limit: () => 10 }).limit({}),
        ).toBe(10);
      });
    });
  });

  describe('default', () => {
    describe('when a number is set', () => {
      test('it uses the number', () => {
        expect(
          adapter({ ...defaultAdapterOpts, default: 20 }).default({}),
        ).toBe(20);
      });
    });

    describe('when a function is set', () => {
      test('it returns the function value', () => {
        expect(
          adapter({ ...defaultAdapterOpts, default: () => 50 }).default({}),
        ).toBe(50);
      });
    });
  });

  describe('load', () => {
    describe('when all arguments are default', () => {
      const expectedGuids = [
        '264585aa-5678-4fb2-893e-0107d1b408e6',
        '52b0c03c-942a-4269-9e25-c9e3513f7c94',
        '748ebcf8-df22-471e-a02b-87f959c1f5a5',
        '72826f66-2f10-4372-81a3-bccaedf6b73e',
        '60cc603e-a538-4abf-8586-f4d43e0a64d0',
        'a143cb6a-7271-4f12-993b-52243ca30870',
        'a5c05b0d-485a-4df5-b549-2a0270982214',
        '549a55b8-5556-4375-93c8-9923d3afd09a',
        '2432441b-e623-4288-8f98-b65197db626f',
        'ae0e7fe5-5722-463d-94bd-8b28633fd242',
      ];

      test('it returns the correct values', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: {},
            primary: 'id',
            max: expectedGuids.length,
            anchors: [],
            order: LoadOrder.ASC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.node.uuid).toBe(expectedGuids[i]);
        });
      });

      test('cursor values are correct', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: {},
            primary: 'id',
            max: expectedGuids.length,
            anchors: [],
            order: LoadOrder.ASC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.cursor()).toBe(String(i + 1)); // id = "1" = String(i + 1)
        });
      });
    });

    describe("when there is a returned 'where' value", () => {
      const expectedGuids = [
        '52b0c03c-942a-4269-9e25-c9e3513f7c94',
        '60cc603e-a538-4abf-8586-f4d43e0a64d0',
        'ae0e7fe5-5722-463d-94bd-8b28633fd242',
        '348f8f6f-b2d5-4ddb-a1bf-5c7433c0df4e',
        '66dcad2e-742e-42a8-8da7-b88262281175',
        'd33cbbc6-9473-4a79-b079-aa4ab7f60146',
        'b3f194ea-7771-4f7f-9668-2dc1cb40ad65',
        '31a90968-97d1-40c8-858c-feeff60e31d5',
        'f2c61afd-c8aa-4a04-bf35-4696331c9211',
        '8d2da349-6e28-45ca-bb36-934d860be476',
      ];

      test('it returns the correct values', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: { createdAt: new Date(TEST_DATE) },
            primary: 'id',
            max: expectedGuids.length,
            anchors: [],
            order: LoadOrder.ASC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.node.uuid).toBe(expectedGuids[i]);
        });
      });
    });

    describe('when there is a returned include value', () => {
      const expectedGuids = [
        '264585aa-5678-4fb2-893e-0107d1b408e6',
        '52b0c03c-942a-4269-9e25-c9e3513f7c94',
        '748ebcf8-df22-471e-a02b-87f959c1f5a5',
        '72826f66-2f10-4372-81a3-bccaedf6b73e',
        '60cc603e-a538-4abf-8586-f4d43e0a64d0',
        'a143cb6a-7271-4f12-993b-52243ca30870',
        '549a55b8-5556-4375-93c8-9923d3afd09a',
        '2432441b-e623-4288-8f98-b65197db626f',
        'e814b76b-65ae-47ef-8425-94c8556a3218',
        'cf2a6b6f-e73f-4f24-bf2c-ec8b229ad734',
      ];
      // Extracted from this query:
      `
      SELECT DISTINCT
        users.id,
        users.uuid
      FROM
        users
        INNER JOIN movies ON users.id = movies.user_id
      WHERE
        movies.rating > 4
      ORDER BY users.id ASC
      LIMIT 10;
      `;

      test('it returns the correct values', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: { rating: 4 },
            primary: 'id',
            max: expectedGuids.length,
            anchors: [],
            order: LoadOrder.ASC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.node.uuid).toBe(expectedGuids[i]);
        });
      });
    });

    describe('when only a subset of fields are set', () => {
      test('it returns the correct values', async () => {
        const expectedLength = 10;
        expect.assertions(3 * expectedLength);

        const results = await adapter().load(
          {
            filter: { createdAt: new Date(TEST_DATE) },
            primary: 'id',
            max: expectedLength,
            anchors: [],
            order: LoadOrder.ASC,
            fields: ['id', 'uuid'],
          },
          {},
        );

        results.forEach(result => {
          expect(result.node.id).not.toBeUndefined();
          expect(result.node.uuid).not.toBeUndefined();
          expect(result.node.firstName).toBeUndefined();
        });
      });
    });

    describe('when the primary field is not added', () => {
      test('it returns the correct values (id is included anyway)', async () => {
        const expectedLength = 10;
        expect.assertions(expectedLength);

        const results = await adapter().load(
          {
            filter: { createdAt: new Date(TEST_DATE) },
            primary: 'id',
            max: expectedLength,
            anchors: [],
            order: LoadOrder.ASC,
            fields: ['uuid'], // id not included
          },
          {},
        );

        results.forEach(result => {
          expect(result.node.id).not.toBeUndefined(); // primary is always set
        });
      });
    });

    describe('when a top anchor is present', () => {
      const expectedGuids = [
        'e814b76b-65ae-47ef-8425-94c8556a3218',
        'cf2a6b6f-e73f-4f24-bf2c-ec8b229ad734',
        '348f8f6f-b2d5-4ddb-a1bf-5c7433c0df4e',
        '41b0a0c5-7743-4b68-8be2-93eef39ec7a1',
        '66dcad2e-742e-42a8-8da7-b88262281175',
        'd33cbbc6-9473-4a79-b079-aa4ab7f60146',
        'b3f194ea-7771-4f7f-9668-2dc1cb40ad65',
        '31a90968-97d1-40c8-858c-feeff60e31d5',
        'f5e5908c-e5d6-48b8-9bcd-37c86cbb8e08',
        '27ea85b9-4e30-4d24-91b8-d5809c8dd64d',
      ];

      test('it returns the correct values', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: {},
            primary: 'id',
            max: expectedGuids.length,
            anchors: [
              {
                type: AdapterAnchorType.GT,
                cursor: '10',
              },
            ],
            order: LoadOrder.ASC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.node.uuid).toBe(expectedGuids[i]);
        });
      });
    });

    describe('when a bottom anchor is present', () => {
      const expectedGuids = [
        '264585aa-5678-4fb2-893e-0107d1b408e6',
        '52b0c03c-942a-4269-9e25-c9e3513f7c94',
        '748ebcf8-df22-471e-a02b-87f959c1f5a5',
        '72826f66-2f10-4372-81a3-bccaedf6b73e',
        '60cc603e-a538-4abf-8586-f4d43e0a64d0',
        'a143cb6a-7271-4f12-993b-52243ca30870',
        'a5c05b0d-485a-4df5-b549-2a0270982214',
        '549a55b8-5556-4375-93c8-9923d3afd09a',
        '2432441b-e623-4288-8f98-b65197db626f',
        'ae0e7fe5-5722-463d-94bd-8b28633fd242',
      ];

      test('it returns the correct values', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: {},
            primary: 'id',
            max: expectedGuids.length,
            anchors: [
              {
                type: AdapterAnchorType.LT,
                cursor: '15',
              },
            ],
            order: LoadOrder.ASC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.node.uuid).toBe(expectedGuids[i]);
        });
      });
    });

    describe('when both top and bottom anchors are present', () => {
      const expectedGuids = [
        'e814b76b-65ae-47ef-8425-94c8556a3218',
        'cf2a6b6f-e73f-4f24-bf2c-ec8b229ad734',
        '348f8f6f-b2d5-4ddb-a1bf-5c7433c0df4e',
        '41b0a0c5-7743-4b68-8be2-93eef39ec7a1',
      ];

      test('it returns the correct values', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: {},
            primary: 'id',
            max: expectedGuids.length,
            anchors: [
              {
                type: AdapterAnchorType.GT,
                cursor: '10',
              },
              {
                type: AdapterAnchorType.LT,
                cursor: '15',
              },
            ],
            order: LoadOrder.ASC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.node.uuid).toBe(expectedGuids[i]);
        });
      });
    });

    describe('when order is set to DESC', () => {
      const expectedGuids = [
        '0025e0b1-c8e5-4f82-bf03-6d1f9a1647ed',
        '8f9e354a-8a21-4bdb-a17b-45bf5eb6dbcc',
        '25aa6472-c952-40d5-960d-8ea65ba850e3',
        '8a90567c-2c41-46cf-88cf-3200e031ed7e',
        'caf1a0bf-a0ea-4324-98db-7539181e673b',
        '489639ad-208c-4183-8bb2-db327a28b9c2',
        '0ede3d86-ff75-4933-8348-e5a8f4e9c934',
        'c9109fc9-5257-46f7-8e8e-ce8e8a863b02',
        '1c6fcd4f-7284-4762-ab09-10a36320b423',
        'bfe45c3e-4819-40a3-9497-e14d17873c90',
      ];

      test('it returns the correct values', async () => {
        expect.assertions(1 + expectedGuids.length);

        const results = await adapter().load(
          {
            filter: {},
            primary: 'id',
            max: expectedGuids.length,
            anchors: [],
            order: LoadOrder.DESC,
            fields: [],
          },
          {},
        );

        expect(results.length).toBe(expectedGuids.length);
        results.forEach((result, i) => {
          expect(result.node.uuid).toBe(expectedGuids[i]);
        });
      });
    });
  });

  describe('count', () => {
    describe("when there is a returned 'where' value", () => {
      test('it returns the correct value', async () => {
        // This is the query that returns the actual value. Data is immutable
        // since it's on a fixture.
        `
          SELECT * FROM users WHERE created_at >= '2018-11-04 09:31:16+00';
        `; // yields 364

        expect.assertions(1);

        expect(
          await adapter().count(
            {
              filter: { createdAt: new Date(TEST_DATE) },
              primary: 'id',
            },
            {},
          ),
        ).toBe(364);
      });
    });

    describe('when there is a returned include value', () => {
      test('it returns the correct value', async () => {
        // This is the query that returns the actual value. Data is immutable
        // since it's on a fixture.
        `
        SELECT
          count(DISTINCT ("User"."id")) AS "count"
        FROM
          "users" AS "User"
          INNER JOIN "movies" AS "movies" ON "User"."id" = "movies"."user_id"
            AND "movies"."rating" > 4;
        `; // yields 364

        expect.assertions(1);

        expect(
          await adapter().count(
            {
              filter: { rating: 4 },
              primary: 'id',
            },
            {},
          ),
        ).toBe(846);
      });
    });
  });
});
