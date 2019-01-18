/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { generateLoadersFileNodes } from '../../lib/codegen';
import { loadersFilePath } from '../../lib/paths';
import { linkLoadersFile } from '../../lib/linking';
import { cliRunWrapper } from '../../lib/runtime';
import {
  makeGraphCodegenPipeline,
  codegenPipelineMaker,
} from '../../lib/cmd/codegen/common';

const generateLoaderFile = codegenPipelineMaker((filePath, fileGraph) => {
  const linkedLoaderFile = linkLoadersFile(filePath, fileGraph);

  // Generate file
  return generateLoadersFileNodes(linkedLoaderFile);
});

export const generateLoaders = makeGraphCodegenPipeline({
  codeGenerator: generateLoaderFile,
  pathGenerator: loadersFilePath,
});

export default cliRunWrapper(generateLoaders);
