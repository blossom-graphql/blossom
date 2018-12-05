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

describe('LoaderInstance', () => {
  describe('get', () => {
    const batchFn = async (ids: number[]) => ids;

    it('should create new Dataloader when key is not set', () => {
      const instance = newInstance();

      const loader = instance.get(batchFn);

      expect(instance.instances.size).toBe(1);
      expect(loader).toBeInstanceOf(Dataloader);
      expect(Dataloader).toHaveBeenCalledWith(batchFn);
    });

    it('should properly cache loader instance', () => {
      const instance = newInstance();

      // The MUST be the exact same location in the heap.
      expect(instance.get(batchFn)).toBe(instance.get(batchFn));
    });
  });
});

describe('createLoaderInstance', () => {
  it('should return unique instances every time the function is invoked', () => {
    const { instance: instance1 } = createLoaderInstance();
    const { instance: instance2 } = createLoaderInstance();

    expect(instance1).not.toBe(instance2);
  });
});
