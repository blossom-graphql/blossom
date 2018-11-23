/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

type PluckingFunction<U, R> = (key: R) => U;

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
      // Is set on top, so we are sure this is *not* undefined. Thus the casting.
      const arr = <R[]>resultMap.get(key);
      arr.push(result);
    }
  });

  // Is set on top, so we are sure this is *not* undefined. Thus the casting.
  return keys.map(key => <R[]>resultMap.get(key));
}
