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

import { parseFileGraph, ParsedFileGraph } from '../../lib/parsing';
import { generateRootFileNodes } from '../../lib/codegen';
import { appPath, rootFilePath } from '../../lib/paths';
import { linkRootFile } from '../../lib/linking';
import { cliRunWrapper } from '../../lib/runtime';
import { repeatChar } from '../../lib/utils';

export async function generateRootFile(
  filePath: string,
  fileGraph: ParsedFileGraph,
) {
  const linkedRootFile = linkRootFile(filePath, fileGraph);

  // Generate file
  const generatedNodeGroups = generateRootFileNodes(linkedRootFile);

  const resultFile = ts.createSourceFile(
    'types.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  const chunks = generatedNodeGroups.map(nodeGroup =>
    nodeGroup.nodes
      .map(node => printer.printNode(ts.EmitHint.Unspecified, node, resultFile))
      .join(repeatChar('\n', nodeGroup.spacing + 1)),
  );

  const generatedFile = chunks.join('\n\n');

  // Use prettier! Retrieve config first
  const prettierConfigExplorer = cosmiconfig('prettier');

  let prettierConfig: any = {};

  try {
    const result = await prettierConfigExplorer.search();

    if (result && !result.isEmpty) {
      prettierConfig = result.config;
    }
  } catch (error) {
    // Prettier settings not found
    // TODO: Logging.
  }

  const formattedFile = prettier.format(generatedFile, {
    parser: 'typescript',
    ...prettierConfig,
  });

  return formattedFile;
}

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
