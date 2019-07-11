/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { generateSourcesFileNodes } from '../../lib/codegen';
import { sourcesFilePath } from '../../lib/paths';
import { linkSourcesFile } from '../../lib/linking';
import { cliRunWrapper } from '../../lib/runtime';
import {
  makeGraphCodegenPipeline,
  codegenPipelineMaker,
  nodeGroupGeneratorMaker,
  GeneratorPair,
} from '../../lib/cmd/codegen/common';

export const sourcesCodegenPair: GeneratorPair = [
  codegenPipelineMaker(nodeGroupGeneratorMaker(linkSourcesFile, generateSourcesFileNodes)),
  sourcesFilePath,
];

export const generateSources = makeGraphCodegenPipeline({
  generatorPairs: [sourcesCodegenPair],
});

export default cliRunWrapper(generateSources);
