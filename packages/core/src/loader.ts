/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Dataloader from 'dataloader';

export class LoaderInstance {
  instances: { [key: string]: any } = {};

  get<K, V>(loader: Dataloader.BatchLoadFn<K, V>): Dataloader<K, V> {
    if (this.instances[loader.name]) {
      return this.instances[loader.name];
    }

    this.instances[loader.name] = new Dataloader(loader);
    return this.instances[loader.name];
  }
}

/**
 * Creates a loader instance, to be used on a single HTTP request.
 */
export function createLoaderInstance() {
  const instance = new LoaderInstance();

  return function getLoader<K, V>(
    loader: Dataloader.BatchLoadFn<K, V>,
  ): Dataloader<K, V> {
    return instance.get(loader);
  };
}
