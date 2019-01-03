/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';

// Real path of the current working directory, including resolution of symlinks.
export const APP_DIR = fs.realpathSync(process.cwd());

/**
 * Given a relative path, returns the absolute path on the current running
 * Blossom project.
 *
 * @param relativePath Relative path in the current Blossom project.
 */
export function appPath(relativePath: string, basePath = APP_DIR): string {
  return path.resolve(basePath, relativePath);
}

export function typesFilePath(schemaFilePath: string): string {
  const parsedPath = path.parse(schemaFilePath);
  const baseFileName = parsedPath.name.split('.')[0];

  return path.join(parsedPath.dir, `${baseFileName}.types.ts`);
}

export function blossomInstancePath(): string {
  return appPath('./blossom-instance.ts');
}

export function projectImportPath(fullPath: string): string {
  const parsed = path.parse(fullPath);
  const noExtensionPath = path.join(parsed.dir, parsed.name);

  return path.relative(APP_DIR, noExtensionPath);
}
