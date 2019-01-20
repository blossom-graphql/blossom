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
} from '../../lib/cmd/codegen/common';

const generateSourcesFile = codegenPipelineMaker((filePath, fileGraph) => {
  const linkedLoaderFile = linkSourcesFile(filePath, fileGraph);

  // Generate file
  return generateSourcesFileNodes(linkedLoaderFile);
});

export const generateSources = makeGraphCodegenPipeline({
  codeGenerator: generateSourcesFile,
  pathGenerator: sourcesFilePath,
});

export default cliRunWrapper(generateSources);
