/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

export const BLOSSOM_CORE_VERSION = process.env.BLOSSOM_DEV_PATH
  ? path.join(process.env.BLOSSOM_DEV_PATH, 'packages', 'core')
  : '0.0.0';
