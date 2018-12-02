/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as Dataloader from 'dataloader';

/**
 * A context for an specific Blossom request.
 */
export interface IBlossomContext<R> {
  /**
   * User-defined context for this request. Can be any type and is defined by
   * the developer by finding the suitable value in the generic signature.
   */
  requestContext: R;
  /**
   * Function to retrieve a loader instance in this particular request.
   */
  loader: <K, V>(loader: Dataloader.BatchLoadFn<K, V>) => Dataloader<K, V>;
}
