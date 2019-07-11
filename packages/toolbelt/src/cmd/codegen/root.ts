/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { generateRootFileNodes } from '../../lib/codegen';
import { rootFilePath } from '../../lib/paths';
import { linkRootFile } from '../../lib/linking';
import { cliRunWrapper } from '../../lib/runtime';
import {
  makeGraphCodegenPipeline,
  codegenPipelineMaker,
  nodeGroupGeneratorMaker,
  GeneratorPair,
} from '../../lib/cmd/codegen/common';

export const rootCodegenPair: GeneratorPair = [
  codegenPipelineMaker(nodeGroupGeneratorMaker(linkRootFile, generateRootFileNodes)),
  rootFilePath,
];

export const generateRoot = makeGraphCodegenPipeline({
  generatorPairs: [rootCodegenPair],
});

export default cliRunWrapper(generateRoot);
