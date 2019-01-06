/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { inspect } from 'util';

export type ErrorsOutput = [number, Error][];
export type ReducedWithErrorsOutput<V> = [V, ErrorsOutput];

// TODO: Overloading for sets.
export function forEachWithErrors<U>(
  iterable: ReadonlyArray<U>,
  callbackfn: (value: U, index: number, array: ReadonlyArray<U>) => void,
  thisArg?: any,
): ErrorsOutput {
  const errors: ErrorsOutput = [];

  iterable.forEach((value, index, array) => {
    try {
      callbackfn(value, index, array);
    } catch (error) {
      errors.push([index, error]);
    }
  }, thisArg);

  return errors;
}

export function reduceWithErrors<U, V>(
  iterable: ReadonlyArray<U>,
  callbackfn: (
    previousValue: V,
    currentValue: U,
    currentIndex: number,
    array: ReadonlyArray<U>,
  ) => V,
  initialValue: V,
) {
  const reducedInitialValue: ReducedWithErrorsOutput<V> = [initialValue, []];

  return iterable.reduce(
    (
      [previousValue, accumulatedErrors],
      currentValue,
      currentIndex,
      array,
    ): ReducedWithErrorsOutput<V> => {
      try {
        const reducedValue = callbackfn(
          previousValue,
          currentValue,
          currentIndex,
          array,
        );

        return [reducedValue, accumulatedErrors];
      } catch (error) {
        accumulatedErrors.push([currentIndex, error]);

        return [previousValue, accumulatedErrors];
      }
    },
    reducedInitialValue,
  );
}

export function fullInspect(object: any) {
  return inspect(object, true, null, true);
}

export function tabMessage(message: string, tabSize: number = 2) {
  const tab = Array.from({ length: tabSize })
    .map(() => ' ')
    .join('');

  return message
    .split('\n')
    .map(l => `${tab}${l}`)
    .join('\n');
}
