/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { inspect } from 'util';

export function fullInspect(object: any) {
  return inspect(object, true, null, true);
}

export function run(fun: () => Promise<any>) {
  try {
    fun().catch(error => {
      console.error(error);
      process.exit(1);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
