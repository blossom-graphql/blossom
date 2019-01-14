/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { inspect } from 'util';
import { OriginDescription, OriginKind } from './linking';

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

export function repeatChar(token: string, length: number): string {
  return Array.from({ length })
    .map(() => token)
    .join('');
}

export function makeTitleOriginDescriptor(
  originDescriptor: OriginDescription,
): string {
  switch (originDescriptor.originKind) {
    case OriginKind.Object:
      return `Type: ${originDescriptor.objectName} > Field: ${
        originDescriptor.fieldName
      }`;
    case OriginKind.ObjectArgument:
      return `Type: ${
        originDescriptor.fieldOriginDescription.objectName
      } > Field: ${
        originDescriptor.fieldOriginDescription.fieldName
      } > Argument: ${originDescriptor.argumentName}`;
      break;
    case OriginKind.Input:
      return `Input: ${originDescriptor.objectName} > Field: ${
        originDescriptor.fieldName
      }`;
    case OriginKind.InputArgument:
      return `Input: ${
        originDescriptor.fieldOriginDescription.objectName
      } > Field: ${
        originDescriptor.fieldOriginDescription.fieldName
      } > Argument: ${originDescriptor.argumentName}`;
    case OriginKind.Union:
      return `Union: ${originDescriptor.name}`;
    case OriginKind.Operation:
      return `Operation: ${originDescriptor.operationType}`;
  }
}
