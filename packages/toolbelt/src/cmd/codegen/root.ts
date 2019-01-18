/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';

import { parseFileGraph } from '../../lib/parsing';
import { generateRootFileNodes, codegenPipelineMaker } from '../../lib/codegen';
import { appPath, rootFilePath } from '../../lib/paths';
import { linkRootFile } from '../../lib/linking';
import { cliRunWrapper } from '../../lib/runtime';

const generateRootFile = codegenPipelineMaker((filePath, fileGraph) => {
  const linkedRootFile = linkRootFile(filePath, fileGraph);

  // Generate file
  return generateRootFileNodes(linkedRootFile);
});

export async function generateRoot(options: {
  file?: string;
  outputFile?: string | boolean;
  recursive?: boolean;
  stdin?: boolean;
  stdout?: boolean;
}) {
  let fullInputFilePath: string = path.join(process.cwd(), 'schema.gql');

  if (options.stdin) {
    throw new Error('Implement me.');
  } else if (options.file) {
    fullInputFilePath = appPath(options.file);
  } else {
    throw new Error('An input for the SDL must be specified.');
  }

  const filesOutput: { [key: string]: string } = {};
  const parsedFileGraph = await parseFileGraph(fullInputFilePath);

  filesOutput[fullInputFilePath] = await generateRootFile(
    fullInputFilePath,
    parsedFileGraph,
  );

  // On recursive mode, output must be generated for all files.
  if (options.recursive) {
    await Promise.all(
      [...parsedFileGraph.keys()].map(async fullPath => {
        filesOutput[fullPath] = await generateRootFile(
          fullPath,
          parsedFileGraph,
        );
      }),
    );
  }

  if (options.stdout && !options.recursive) {
    console.log(filesOutput[fullInputFilePath]);
  } else {
    await Promise.all(
      Object.entries(filesOutput).map(async ([fullPath, contents]) => {
        const rootFilePathname = rootFilePath(fullPath);

        await fs.promises.writeFile(rootFilePathname, contents);
      }),
    );
  }
}

export default cliRunWrapper(generateRoot);
