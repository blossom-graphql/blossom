/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import * as ts from 'typescript';
import { DocumentNode, parse } from 'graphql';
import cosmiconfig from 'cosmiconfig';
import prettier from 'prettier';

import { parseDocumentNode } from '../../lib/parsing';
import { generateTypeAlias } from '../../lib/codegen';

function getDocument(): DocumentNode | undefined {
  try {
    return parse(readFileSync(join(__dirname, 'test.gql')).toString('utf-8'));
  } catch (SyntaxError) {
    console.error('Was an error with the syntax.');
    return undefined;
  }
}

async function run() {
  // Parse document
  const document = getDocument();

  if (!document) {
    throw new Error('No valid document. Quitting.');
  }

  const parsing = parseDocumentNode(document);

  console.log(JSON.stringify(parsing, null, 2));

  const resultFile = ts.createSourceFile(
    'test.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  const printedNodes: string[] = [...parsing.objects, ...parsing.inputs].map(
    object =>
      printer.printNode(
        ts.EmitHint.Unspecified,
        generateTypeAlias(object),
        resultFile,
      ),
  );

  const generatedFile = printedNodes.join('\n\n');

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

  console.log(formattedFile);
}

try {
  run()
    .then(() => process.extest(0))
    .catch(error => {
      console.error(error);
      process.extest(1);
    });
} catch (error) {
  console.error(error);
  process.extest(1);
}
