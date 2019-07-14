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
  addPackage,
} from '../../../lib/cmd/bootstrap/common';
import { BLOSSOM_CORE_VERSION } from '../../../lib/constants';

export default async function koaBootstrap(): Promise<ActionDescriptor[]> {
  const actions: ActionDescriptor[] = [
    addDependencies(packages),
    await copyFiles(path.join(__dirname, '..', '..', '..', '..', 'templates', 'koa')),
    await installDependencies(),
    await addPackage('@blossom-gql/core', BLOSSOM_CORE_VERSION),
  ];

  return actions;
}
