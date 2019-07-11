/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { generateResolversFileNodes } from '../../lib/codegen';
import { resolversFilePath } from '../../lib/paths';
import { linkResolversFile } from '../../lib/linking';
import { cliRunWrapper } from '../../lib/runtime';
import {
  makeGraphCodegenPipeline,
  codegenPipelineMaker,
  nodeGroupGeneratorMaker,
  GeneratorPair,
} from '../../lib/cmd/codegen/common';

export const resolversCodegenPair: GeneratorPair = [
  codegenPipelineMaker(nodeGroupGeneratorMaker(linkResolversFile, generateResolversFileNodes)),
  resolversFilePath,
];

export const generateResolvers = makeGraphCodegenPipeline({
  generatorPairs: [resolversCodegenPair],
});

export default cliRunWrapper(generateResolvers);
