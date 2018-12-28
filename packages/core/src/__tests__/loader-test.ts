/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Dataloader from 'dataloader';
jest.mock('dataloader');

import { createLoaderInstance, LoaderInstance } from '../loader';

function newInstance() {
  return new LoaderInstance();
}

const batchFn = async (ids: number[]) => ids;

describe(LoaderInstance, () => {
  describe('get', () => {
    test('should create new Dataloader when key is not set', () => {
      const instance = newInstance();

      const loader = instance.get(batchFn);

      expect(instance.instances.size).toBe(1);
      expect(loader).toBeInstanceOf(Dataloader);
      expect(Dataloader).toHaveBeenCalledWith(batchFn);
    });

    test('should properly cache loader instance', () => {
      const instance = newInstance();

      // The MUST be the exact same location in the heap.
      expect(instance.get(batchFn)).toBe(instance.get(batchFn));
    });
  });
});

describe(createLoaderInstance, () => {
  test('should return unique instances every time the function is invoked', () => {
    const { instance: instance1 } = createLoaderInstance();
    const { instance: instance2 } = createLoaderInstance();

    expect(instance1).not.toBe(instance2);
  });

  test('should instance.get() with correct arguments when getLoader() is invoked', () => {
    const { getLoader, instance } = createLoaderInstance();
    const exampleLoader = new Dataloader(batchFn);

    // Replace instance's get method with the mock.
    instance.get = jest
      .fn<typeof instance.get>()
      .mockReturnValueOnce(exampleLoader);

    const result = getLoader(batchFn);

    expect(instance.get).toHaveBeenCalled();
    expect(result).toBe(exampleLoader);
  });
});
