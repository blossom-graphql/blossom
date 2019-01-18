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
} from '../../lib/cmd/codegen/common';

const generateRootFile = codegenPipelineMaker((filePath, fileGraph) => {
  const linkedRootFile = linkRootFile(filePath, fileGraph);

  // Generate file
  return generateRootFileNodes(linkedRootFile);
});

export const generateRoot = makeGraphCodegenPipeline({
  codeGenerator: generateRootFile,
  pathGenerator: rootFilePath,
});

export default cliRunWrapper(generateRoot);
