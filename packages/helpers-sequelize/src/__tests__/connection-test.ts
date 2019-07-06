import { Op } from 'sequelize';

import User, { cleanup, setup } from './fixtures/user';
import {
  sequelizeConnectionAdapter,
  SequelizeConnectionArgsMapper,
} from '../connection';

beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  await cleanup();
});

describe(sequelizeConnectionAdapter, () => {
  type UsersFilter = {
    firstName?: string;
    lastName?: string;
  };
  const mapper: SequelizeConnectionArgsMapper<
    UsersFilter,
    User,
    any
  > = args => {
    const firstName = args.filter.firstName
      ? { firstName: { [Op.iLike]: args.filter.firstName } }
      : undefined;

    return {
      where: { ...firstName },
    };
  };

  const adapter = sequelizeConnectionAdapter(User, mapper);

  test('it works', async () => {
    expect.assertions(1);

    expect(
      await adapter.count(
        { filter: { firstName: 'Sandy' }, primary: 'id' },
        {},
      ),
    ).toBe(1);
  });

  describe('limit', () => {
    describe('when a number is set', () => {
      xtest('it uses the number', () => {
        // write me
      });
    });
    describe('when a function is set', () => {
      xtest('it returns the function value', () => {
        // write me
      });
    });
  });

  describe('default', () => {
    describe('when a number is set', () => {
      xtest('it uses the number', () => {
        // write me
      });
    });

    describe('when a function is set', () => {
      xtest('it returns the function value', () => {
        // write me
      });
    });
  });

  describe('load', () => {
    describe("when there is a returned 'where' value", () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when there is a returned include value', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when no fields are set', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when the primary field is not added', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when a top anchor is present', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when a bottom anchor is present', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when both anchors are present', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when order is set to ASC', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });

    describe('when order is set to DESC', () => {
      xtest('it returns the correct values', () => {
        // write me
      });
    });
  });

  describe('count', () => {
    describe("when there is a returned 'where' value", () => {
      xtest('it returns the correct value', () => {
        // write me
      });
    });

    describe('when there is a returned include value', () => {
      xtest('it returns the correct value', () => {
        // write me
      });
    });
  });
});
