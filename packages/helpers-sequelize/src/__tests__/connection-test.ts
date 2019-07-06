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
});
