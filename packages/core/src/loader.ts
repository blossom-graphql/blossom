/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Dataloader from 'dataloader';

interface ILoaderInstance {
  get: <K, V>(batchFunction: Dataloader.BatchLoadFn<K, V>) => Dataloader<K, V>;
}

/**
 * Singleton that contains all the loader instances for an specific blossom
 * requests.
 */
export class LoaderInstance implements ILoaderInstance {
  /**
   * Map that contains the already existing instances for the request.
   */
  instances: Map<
    Dataloader.BatchLoadFn<any, any>,
    Dataloader<any, any>
  > = new Map();

  /**
   * Given a batch functions, retrieves the instance of the dataloader
   * associated to it in this specific request.
   *
   * If there's none, it's created.
   *
   * @param batchFunction Name of the batch function that creates a loader.
   */
  get<K, V>(batchFunction: Dataloader.BatchLoadFn<K, V>): Dataloader<K, V> {
    // Retrieve from the map and guard from not-null value.
    const dataLoaderInstance = this.instances.get(batchFunction);
    if (dataLoaderInstance) {
      return dataLoaderInstance;
    }

    // It doesn't exist. Create it and return it.
    const newDataLoaderInstance = new Dataloader(batchFunction);
    this.instances.set(batchFunction, newDataLoaderInstance);
    return newDataLoaderInstance;
  }
}

type LoaderRetrieveFunction = <K, V>(
  batchFunction: Dataloader.BatchLoadFn<K, V>,
) => Dataloader<K, V>;

interface ILoaderInstanceProxy {
  instance: ILoaderInstance;
  getLoader: LoaderRetrieveFunction;
}

/**
 * Creates a loader instance, **to be used on a single Blossom request**.
 */
export function createLoaderInstance(): ILoaderInstanceProxy {
  const instance = new LoaderInstance();

  /**
   * Retrieves the loader from the instance given its associated batch function.
   */
  return {
    instance,
    getLoader: function getLoader<K, V>(
      batchFunction: Dataloader.BatchLoadFn<K, V>,
    ): Dataloader<K, V> {
      return instance.get(batchFunction);
    },
  };
}
