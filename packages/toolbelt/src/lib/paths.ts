/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { realpathSync } from 'fs';
import { resolve } from 'path';

// Real path of the current working directory, including resolution of symlinks.
const appDir = realpathSync(process.cwd());

/**
 * Given a relative path, returns the absolute path on the current running
 * Blossom project.
 *
 * @param relativePath Relative path in the current Blossom project.
 */
export function appPath(relativePath: string): string {
  return resolve(appDir, relativePath);
}
