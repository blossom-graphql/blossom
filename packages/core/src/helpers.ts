/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * A function used as iteratee over `deliver` and `deliverGroup` operations:
 * invoked on each element of the results in order to extract an scalar
 * comparable to the `keys` elements.
 */
type PluckingFunction<U, R> = (key: R) => U;

/**
 * Given an array of identifiers and an array of (not necessarily) matching
 * results, uses `plucker` over each result to map it to the expected position
 * in `keys`.
 *
 * Some considerations:
 *
 * - If no result is found in `results` for an specific key, that position will
 *   be marked as `null`.
 *
 * - If there's more than one result for wich `pluckingFunction` returns the
 *   same scalar that's being queried in `keys`, the one with the biggest
 *   position index in `results` will be picked.
 *
 *   If you are expecting multiple results, then `deliverGroup` should be used
 *   instead of this function.
 *
 * The behavior of this function can be easily understood with some examples:
 *
 * Example 1: Delivering results to its keys extracing by ID.
 *
 *  ```
 *  > const keys = [1, 2, 3, 4]
 *  > const results = [{ id: 3 }, { id: 2 }, { id: 4 }, { id: 1 }]
 *  > deliver(keys, results, ({ id }) => id)
 *  ```
 *
 *  **Output:**
 *
 *  ```
 *  [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
 *       ^          ^          ^          ^
 *       |          |          |          |
 *    keys[0]    keys[1]    keys[2]    keys[3]
 *  ```
 *
 * Example 2: When one of the keys is not available in the results that position
 * will be filled with `null`:
 *
 *  ```
 *  > const keys = [1, 2, 3, 4]
 *  > const results = [{ id: 3 }, { id: 4 }, { id: 1 }]
 *  > deliver(keys, results, ({ id }) => id)
 *  ```
 *
 *  **Output:**
 *
 *  ```
 *  [{ id: 1 }, null, { id: 3 }, { id: 4 }]
 *       ^        ^       ^          ^
 *       |        |       |          |
 *    keys[0]  keys[1] keys[2]    keys[3]
 *  ```
 *
 * Example 3: If keys appear more than one time on the array, they will be
 * matched accordingly.
 *
 *  ```
 *  > const keys = [1, 2, 3, 2]
 *  > const results = [{ id: 3 }, { id: 2 }, { id: 1 }]
 *  > deliver(keys, results, ({ id }) => id)
 *  ```
 *
 *  **Output:**
 *
 *  ```
 *  [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 2 }]
 *       ^          ^          ^          ^
 *       |          |          |          |
 *    keys[0]    keys[1]    keys[2]    keys[3]
 *  ```
 *
 * Example 4: When the results have duplicate identifying scalars, the most
 * recent one is picked:
 *
 *  ```
 *  > const keys = [1]
 *  > const results = [{ id: 1, key: 'foo' }, { id: 1, key: 'bar' }]
 *  > deliver(keys, results, ({ id }) => id)
 *  ```
 *
 *  **Output:**
 *
 *  ```
 *  [{ id: 1, key: 'bar' }]
 *  ```
 *
 * @param keys Array with the keys expected to get results.
 *
 * @param results An array (not necessarily matching `keys` that contains all
 * the results from the fetching operation).
 *
 * @param plucker The function used to iterate over each `results` array to
 * obtain a unique identifier that matches those on `keys`.
 */
export function deliver<U, R>(
  keys: U[],
  results: R[],
  plucker: PluckingFunction<U, R>,
): (R | null)[] {
  const resultMap = new Map<U, R>();

  results.forEach(result => {
    const key = plucker(result);

    resultMap.set(key, result);
  });

  return keys.map(key => resultMap.get(key) || null);
}

/**
 * `deliverGroup` works in a pretty much similar fashion to `deliver`, but
 * instead of assuming that there's only one result per key in `results`, there
 * could me multiple and they should be aggregated in arrays.
 *
 * If no results are found for an specific key, an empty array (`[]`) is
 * returned instead.
 *
 * Let's consider the following example in order to understand how it works:
 *
 * ```
 * > const keys = [1, 2, 3]
 * > const results = [
 *  { id: 1, fruit: 'apple' },
 *  { id: 3, fruit: 'ornage' },
 *  { id: 1, fruit: 'grape' },
 *  { id: 1, fruit: 'mango' },
 *  { id: 3, fruit: 'grape' },
 *  { id: 1, fruit: 'banana' },
 *  { id: 1, fruit: 'strawberry' },
 * ]
 * > deliverGroup(keys, results, ({ id }) => id)
 * ```
 *
 * This results in this example are:
 *
 * ```
 * [
 *   [ // <--- keys[0]: 1
 *     { id: 1, fruit: 'apple' },
 *     { id: 1, fruit: 'grape' },
 *     { id: 1, fruit: 'mango' },
 *     { id: 1, fruit: 'banana' },
 *     { id: 1, fruit: 'strawberry' },
 *   ],
 *   [ // <--- keys[1]: 2 (no results, thus empty array)
 *   ],
 *   [ // <--- keys[2]: 3
 *     { id: 3, fruit: 'ornage' },
 *     { id: 3, fruit: 'grape' },
 *   ],
 * ]
 * ```
 *
 * @param keys Array with the keys expected to get results.
 *
 * @param results An array (not necessarily matching `keys` that contains all
 * the results from the fetching operation).
 *
 * @param plucker The function used to iterate over each `results` array to
 * obtain a unique identifier that matches those on `keys`.
 */
export function deliverGroup<U, R>(
  keys: U[],
  results: R[],
  plucker: PluckingFunction<U, R>,
): (R[])[] {
  const resultMap = new Map<U, R[]>();

  results.forEach(result => {
    const key = plucker(result);

    if (!resultMap.has(key)) {
      resultMap.set(key, [result]);
    } else {
      // Is set on top, so we are sure this is *not* undefined. This is the
      // reasoning between the explicit casting here.
      const arr = resultMap.get(key) as R[];
      arr.push(result);
    }
  });

  // Is set on top, so we are sure this is *not* undefined. Thus the casting.
  return keys.map(key => resultMap.get(key) || []);
}
