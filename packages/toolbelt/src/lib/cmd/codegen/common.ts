/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';

import ts from 'typescript';
import cosmiconfig from 'cosmiconfig';
import prettier from 'prettier';

import { appPath } from '../../paths';
import { parseFileGraph, ParsedFileGraph } from '../../parsing';
import { CODE_GROUP_SPACING, CodeGroup } from '../../codegen';
import { repeatChar } from '../../utils';

export type CommonCodegenOptions = {
  file?: string;
  outputFile?: string | boolean;
  recursive?: boolean;
  stdin?: boolean;
  stdout?: boolean;
};

// TODO: Move to common.
export function generateCodeChunks(
  groups: ReadonlyArray<CodeGroup>,
): ReadonlyArray<string> {
  const sourceFile = ts.createSourceFile(
    'output.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  return groups.map(nodeGroup =>
    nodeGroup.nodes
      .map(node => printer.printNode(ts.EmitHint.Unspecified, node, sourceFile))
      .join(repeatChar('\n', nodeGroup.spacing + 1)),
  );
}

// TODO: Move to common.
export async function formatOutput(codeOutput: string): Promise<string> {
  const prettierConfigExplorer = cosmiconfig('prettier');

  let prettierConfig: any = {};

  try {
    const result = await prettierConfigExplorer.search();

    if (result && !result.isEmpty) {
      prettierConfig = result.config;
    }
  } catch (error) {
    // Prettier settings not found. Do anything to code.
    // TODO: Logging.
    return codeOutput;
  }

  return prettier.format(codeOutput, {
    parser: 'typescript',
    ...prettierConfig,
  });
}

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
