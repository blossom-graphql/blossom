/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { writeFileSync } from 'fs';
import path from 'path';

import ts from 'typescript';
import cosmiconfig from 'cosmiconfig';
import prettier from 'prettier';

import VERSION from '../../version';
import { parseFileGraph, ParsedFileGraph } from '../../lib/parsing';
import { generateTypesFileNodes } from '../../lib/codegen';
import { appPath, typesFilePath } from '../../lib/paths';
import { linkTypesFile } from '../../lib/linking';
import { cliRunWrapper } from '../../lib/runtime';

export async function generateTypesFile(
  filePath: string,
  fileGraph: ParsedFileGraph,
) {
  const linkedTypesFile = linkTypesFile(filePath, fileGraph);

  // Generate file
  const generatedNodeGroups = generateTypesFileNodes(linkedTypesFile);

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

  const autoGeneratedComment = `/**
 * Autogenerated with Blossom Toolbelt v${VERSION}.
 *
 * DO NOT MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING.
 */`;

  const chunks = generatedNodeGroups.map(nodes =>
    nodes
      .map(node => printer.printNode(ts.EmitHint.Unspecified, node, resultFile))
      .join('\n'),
  );

  const generatedFile = [autoGeneratedComment, ...chunks].join('\n\n');

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
    parser: 'babylon',
    ...prettierConfig,
  });

  return formattedFile;
}

export async function generateTypes(options: {
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

  const parsedFileGraph = await parseFileGraph(fullInputFilePath);

  const formattedFile = await generateTypesFile(
    fullInputFilePath,
    parsedFileGraph,
  );

  if (options.stdout) {
    console.log(formattedFile);
  } else {
    writeFileSync(typesFilePath(fullInputFilePath), formattedFile);
  }
}

export default cliRunWrapper(generateTypes);