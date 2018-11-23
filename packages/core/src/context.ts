/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as Dataloader from 'dataloader';

export interface IBlossomContext<R> {
  requestContext: R;
  loader: <K, V>(loader: Dataloader.BatchLoadFn<K, V>) => Dataloader<K, V>;
}
