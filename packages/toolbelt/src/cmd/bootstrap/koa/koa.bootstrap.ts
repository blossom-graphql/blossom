/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import packages from './koa.packages';
import {
  ActionDescriptor,
  addDependencies,
  copyFiles,
  installDependencies,
} from '../common';

export default async function koaBootstrap(): Promise<ActionDescriptor[]> {
  const actions: ActionDescriptor[] = [
    addDependencies(packages),
    await copyFiles(
      path.join(__dirname, '..', '..', '..', '..', 'templates', 'koa'),
    ),
    await installDependencies(),
  ];

  return actions;
}
