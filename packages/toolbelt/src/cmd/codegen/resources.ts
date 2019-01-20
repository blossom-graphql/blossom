/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { cliRunWrapper } from '../../lib/runtime';
import { makeGraphCodegenPipeline } from '../../lib/cmd/codegen/common';

import { typesCodegenPair } from './types';
import { sourcesCodegenPair } from './sources';
import { resolversCodegenPair } from './resolvers';
import { rootCodegenPair } from './root';

export const generateResources = makeGraphCodegenPipeline({
  generatorPairs: [
    typesCodegenPair,
    rootCodegenPair,
    sourcesCodegenPair,
    resolversCodegenPair,
  ],
});

export default cliRunWrapper(generateResources);
