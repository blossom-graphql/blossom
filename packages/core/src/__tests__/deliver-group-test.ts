/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { deliverGroup } from '../helpers';

const pluckById = ({ id }: { id: number }) => id;

describe(deliverGroup, () => {
  it('should return correct values on empty results array', () => {
    const KEYS = [1, 2, 3];
    const RESULTS: { id: number }[] = [];

    const EXPECTED = [[], [], []];

    expect(deliverGroup(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });

  it("should return correct values when there's only one matching result per key", () => {
    const KEYS = [1, 2, 3];
    const RESULTS = [{ id: 2 }, { id: 3 }, { id: 1 }];

    const EXPECTED = [[{ id: 1 }], [{ id: 2 }], [{ id: 3 }]];

    expect(deliverGroup(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });

  it('should return correct values when there are multiple results per key', () => {
    const KEYS = [1, 2, 3];
    const RESULTS = [
      { id: 2, key: 'foo' },
      { id: 3, key: 'foo' },
      { id: 1, key: 'foo' },
      { id: 2, key: 'bar' },
    ];

    const EXPECTED = [
      [{ id: 1, key: 'foo' }],
      [{ id: 2, key: 'foo' }, { id: 2, key: 'bar' }],
      [{ id: 3, key: 'foo' }],
    ];

    expect(deliverGroup(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });

  it('should return correct values when there are duplicated keys', () => {
    const KEYS = [1, 2, 3, 2];
    const RESULTS = [{ id: 2 }, { id: 3 }, { id: 1 }];

    const EXPECTED = [[{ id: 1 }], [{ id: 2 }], [{ id: 3 }], [{ id: 2 }]];

    expect(deliverGroup(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });
});
