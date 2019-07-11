/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import Dataloader from 'dataloader';

import { BatchFunction } from './common';
import { BlossomContext } from './context';

export type BlossomLoaderSignature<C> = {
  <K, V>(batchFn: BatchFunction<K, V, C>): Dataloader<K, V>;
  instance: LoaderInstance<C>;
};

export class LoaderInstance<C> {
  private context: C | undefined = undefined;

  loaderMap: Map<BatchFunction<any, any, any>, Dataloader<any, any>> = new Map();

  constructor() {}

  setContext(context: C) {
    this.context = context;
  }

  getLoader<K, V>(batchFn: BatchFunction<K, V, C>): Dataloader<K, V> {
    if (!this.context) throw new Error(`Instance context is not set yet.`);

    const existingBatchFn = this.loaderMap.get(batchFn);
    if (existingBatchFn) {
      return existingBatchFn;
    }

    // Just a reference because otherwise the guard above doesn't work
    // ! Notice that setContext enforces the context presence.
    // ! Cannot be unset once is set.
    const context = this.context;
    const compositeBatchFn = (keys: K[]) => batchFn(keys, context);
    const newLoader = new Dataloader(compositeBatchFn);

    this.loaderMap.set(batchFn, newLoader);
    return newLoader;
  }
}

export function generateLoaderInstance<C>(): BlossomLoaderSignature<BlossomContext<C>> {
  const instance = new LoaderInstance<BlossomContext<C>>();

  const exportedFunction = <K, V>(batchFn: BatchFunction<K, V, BlossomContext<C>>) => {
    return instance.getLoader(batchFn);
  };
  exportedFunction.instance = instance;

  return exportedFunction;
}
