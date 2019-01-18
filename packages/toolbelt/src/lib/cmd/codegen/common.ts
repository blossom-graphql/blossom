/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';

import { appPath } from '../../paths';
import { parseFileGraph, ParsedFileGraph } from '../../parsing';
import {
  generateCodeChunks,
  CODE_GROUP_SPACING,
  formatOutput,
  CodeGroup,
} from '../../codegen';

export type CommonCodegenOptions = {
  file?: string;
  outputFile?: string | boolean;
  recursive?: boolean;
  stdin?: boolean;
  stdout?: boolean;
};

export function codegenPipelineMaker(
  nodeGroupMaker: (
    filePath: string,
    fileGraph: ParsedFileGraph,
  ) => ReadonlyArray<CodeGroup>,
  headerText?: string,
) {
  return async function generator(
    filePath: string,
    fileGraph: ParsedFileGraph,
  ) {
    const nodeGroups = nodeGroupMaker(filePath, fileGraph);

    let generatedCode: string;
    if (headerText) {
      generatedCode = [headerText, ...generateCodeChunks(nodeGroups)].join(
        CODE_GROUP_SPACING,
      );
    } else {
      generatedCode = generateCodeChunks(nodeGroups).join(CODE_GROUP_SPACING);
    }

    return await formatOutput(generatedCode);
  };
}

export function makeGraphCodegenPipeline(opts: {
  codeGenerator: (
    filePath: string,
    fileGraph: ParsedFileGraph,
  ) => Promise<string>;
  pathGenerator: (schemaFilePath: string) => string;
}) {
  const { codeGenerator, pathGenerator } = opts;

  return async function codegenPipeline(options: CommonCodegenOptions) {
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

    // Generate the base file and check other files to generate by checking
    // the recursive option.
    const baseGenerator = async () => {
      filesOutput[fullInputFilePath] = await codeGenerator(
        fullInputFilePath,
        parsedFileGraph,
      );
    };

    let extraGenerators: Promise<void>[] = [];
    if (options.recursive) {
      extraGenerators = Object.entries(filesOutput).map(
        async ([fullPath, contents]) => {
          const typesFilePathname = pathGenerator(fullPath);

          await fs.promises.writeFile(typesFilePathname, contents);
        },
      );
    }

    await Promise.all([baseGenerator(), ...extraGenerators]);

    if (options.stdout && !options.recursive) {
      console.log(filesOutput[fullInputFilePath]);
    } else {
      await Promise.all(
        Object.entries(filesOutput).map(async ([fullPath, contents]) => {
          const typesFilePathname = pathGenerator(fullPath);

          await fs.promises.writeFile(typesFilePathname, contents);
        }),
      );
    }
  };
}
