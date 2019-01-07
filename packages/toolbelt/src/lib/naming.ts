/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { camelCase, upperFirst } from 'lodash';

export function resolverSignatureName(methodName: string): string {
  return upperFirst(camelCase(methodName)) + 'Resolver';
}

export function rootResolverName(methodName: string): string {
  return camelCase(methodName) + 'Resolver';
}
