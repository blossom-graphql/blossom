/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { BlossomLoaderSignature } from './new-loader';

/**
 * A context for an specific Blossom request.
 */
export type BlossomContext<R> = {
  /**
   * User-defined context for this request. Can be any type and is defined by
   * the developer by finding the suitable value in the generic signature.
   */
  requestContext: R;
  /**
   * Function to retrieve a loader instance in this particular request.
   */
  loader: BlossomLoaderSignature<BlossomContext<R>>;
};
