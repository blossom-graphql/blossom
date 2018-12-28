/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { deliver } from '../helpers';

const pluckById = ({ id }: { id: number }) => id;

describe(deliver, () => {
  test('should return correct values on empty array', () => {
    const KEYS = [1, 2, 3];
    const RESULTS: { id: number }[] = [];

    const EXPECTED = [null, null, null];

    expect(deliver(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });

  test('should return correct values on all-matching arrays', () => {
    const KEYS = [1, 2, 3];
    const RESULTS = [{ id: 2 }, { id: 3 }, { id: 1 }];

    const EXPECTED = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(deliver(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });

  test('should return correct values when key is duplicated', () => {
    const KEYS = [1, 2, 3, 2];
    const RESULTS = [{ id: 2 }, { id: 3 }, { id: 1 }];

    const EXPECTED = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 2 }];

    expect(deliver(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });

  test('should pick the latest result when the plucking scalar is duplicated', () => {
    const KEYS = [1, 2, 3];
    const RESULTS = [
      { id: 2, key: 'foo' },
      { id: 3, key: 'foo' },
      { id: 1, key: 'foo' },
      { id: 2, key: 'bar' },
    ];

    const EXPECTED = [
      { id: 1, key: 'foo' },
      { id: 2, key: 'bar' },
      { id: 3, key: 'foo' },
    ];

    expect(deliver(KEYS, RESULTS, pluckById)).toEqual(EXPECTED);
  });
});
