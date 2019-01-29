/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import fsExtra from 'fs-extra';
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

export function nodeGroupGeneratorMaker<T>(
  linker: (filePath: string, fileGraph: ParsedFileGraph) => T,
  nodeGenerator: (contents: T) => ReadonlyArray<CodeGroup>,
) {
  return function nodeGroupGenerator(
    filePath: string,
    fileGraph: ParsedFileGraph,
  ): ReadonlyArray<CodeGroup> {
    const fileContents = linker(filePath, fileGraph);

    return nodeGenerator(fileContents);
  };
}

export function codegenPipelineMaker(
  nodeGroupGenerator: (
    filePath: string,
    fileGraph: ParsedFileGraph,
  ) => ReadonlyArray<CodeGroup>,
  headerText?: string,
) {
  return async function generator(
    filePath: string,
    fileGraph: ParsedFileGraph,
  ) {
    const nodeGroups = nodeGroupGenerator(filePath, fileGraph);

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

export type GeneratorPair = [
  (filePath: string, fileGraph: ParsedFileGraph) => Promise<string>,
  (schemaFilePath: string) => string
];

export function makeGraphCodegenPipeline(opts: {
  generatorPairs: GeneratorPair[];
}) {
  const { generatorPairs } = opts;

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

    // Generate all the files based on the pairs.
    const codegenPromises = generatorPairs.map(
      async ([codeGenerator, pathGenerator]) => {
        const outputFilePath = pathGenerator(fullInputFilePath);
        const parsedFileGraph = await parseFileGraph(fullInputFilePath);

        // Generate the base file and check other files to generate by checking
        // the recursive option.
        const baseGenerator = async () => {
          filesOutput[outputFilePath] = await codeGenerator(
            fullInputFilePath,
            parsedFileGraph,
          );
        };

        // On recursive mode, generate code for all the extra files in the
        // file graph.
        let extraGenerators: Promise<void>[] = [];
        if (options.recursive) {
          extraGenerators = [...parsedFileGraph.keys()].map(async fullPath => {
            const typesFilePathname = pathGenerator(fullPath);

            filesOutput[typesFilePathname] = await codeGenerator(
              fullPath,
              parsedFileGraph,
            );
          });
        }

        await Promise.all([baseGenerator(), ...extraGenerators]);

        if (options.stdout && !options.recursive) {
          console.log(filesOutput[outputFilePath]);
        }
      },
    );

    await Promise.all(codegenPromises);

    if (!options.stdout) {
      const writePromises = Object.entries(filesOutput).map(
        ([path, contents]) => fsExtra.writeFile(path, contents),
      );

      await writePromises;
    }
  };
}

export function comment(
  segments: ReadonlyArray<string>,
  ..._replacements: any[]
): string {
  const joined = segments.join('');
  const start = joined.startsWith('\n') ? 1 : 0;
  const end = joined.endsWith('\n') ? joined.length - 1 : joined.length;

  return joined.slice(start, end);
}
