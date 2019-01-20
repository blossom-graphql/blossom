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
} from '../../lib/cmd/codegen/common';

const generateResolversFile = codegenPipelineMaker((filePath, fileGraph) => {
  const linkedResolversFile = linkResolversFile(filePath, fileGraph);

  // Generate file
  return generateResolversFileNodes(linkedResolversFile);
});

export const generateResolvers = makeGraphCodegenPipeline({
  codeGenerator: generateResolversFile,
  pathGenerator: resolversFilePath,
});

export default cliRunWrapper(generateResolvers);
