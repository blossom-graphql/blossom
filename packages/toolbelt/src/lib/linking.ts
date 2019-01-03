/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ParsedFileGraph, ObjectTypeDescription, ThunkType } from './parsing';
import { typesFilePath, blossomInstancePath } from './paths';

const CORE_PACKAGE_NAME = '@blossom-gql/core';

type ImportMembersMap = Map<'default' | string, string | undefined>;

type ImportDescription = VendorImportDescription | FileImportDescription;

type VendorImportDescription = {
  kind: 'VendorImport';
  moduleName: string;
  membersMap: ImportMembersMap;
};

type FileImportDescription = {
  kind: 'FileImport';
  fullPath: string;
  membersMap: ImportMembersMap;
};

type ImportGroupMap = Map<string, ImportDescription>;

export type TypesFileContents = {
  vendorImports: ImportGroupMap;
  fileImports: ImportGroupMap;
  typeDeclarations: ObjectTypeDescription[];
};

export function addImport(
  importGroupMap: ImportGroupMap,
  kind: 'VendorImport' | 'FileImport',
  moduleName: string,
  memberName: string,
  alias?: string,
) {
  const description = importGroupMap.get(moduleName);

  if (description) {
    if (!description.membersMap.has(memberName)) {
      description.membersMap.set(memberName, alias);
    }
  } else {
    const membersMap = new Map([[memberName, alias]]);

    const result: ImportDescription =
      kind === 'VendorImport'
        ? {
            kind,
            moduleName,
            membersMap,
          }
        : { kind, fullPath: moduleName, membersMap };

    importGroupMap.set(moduleName, result);
  }
}

export function linkTypesFile(
  file: string,
  fileGraph: ParsedFileGraph,
): TypesFileContents {
  const parsedFile = fileGraph.get(file);
  if (!parsedFile) {
    throw new Error(`Parsing for file ${parsedFile} not found in fileGraph.`);
  }

  const result: TypesFileContents = {
    vendorImports: new Map(),
    fileImports: new Map(),
    typeDeclarations: [],
  };

  let requiresMaybe: boolean = false;
  let requiresThunkImports: boolean = false;

  const parsedDocument = parsedFile.parsedDocument;
  parsedDocument.objects.forEach(descriptor => {
    if (!requiresMaybe)
      requiresMaybe = !!descriptor.fields.find(field => !field.required);

    if (!requiresThunkImports)
      requiresThunkImports = !!descriptor.fields.find(
        field => field.thunkType !== ThunkType.None,
      );

    descriptor.referencedTypes.forEach(field => {
      // 1. Search in the object.
      if (parsedDocument.objects.has(field)) {
        // Linking passed. Nothing to do here because it's already on the file.
        // TODO: Log
        return;
      } else {
        // 2. Search in references explicitly.
        const existingRef = [...parsedFile.references.named.entries()].find(
          ([_, map]) => map.has(field),
        );

        if (existingRef) {
          const [schemaPath] = existingRef;
          addImport(
            result.fileImports,
            'FileImport',
            typesFilePath(schemaPath),
            field,
          );
          return;
        }

        // 3. Search in references with wildcards.
        const schemaPath = [...parsedFile.references.full].find(schemaPath => {
          const parsedReference = fileGraph.get(schemaPath);

          if (!parsedReference)
            throw new Error( // TODO: Specific error.
              `Parsed file for ${schemaPath} not found fileGraph.`,
            );

          // TODO: What about enums and aliases? This needs to be refactored.
          return parsedReference.parsedDocument.objects.has(field);
        });

        // TODO: Log
        if (schemaPath) {
          addImport(
            result.fileImports,
            'FileImport',
            typesFilePath(schemaPath),
            field,
          );
        } else {
          throw new Error( // TODO: Wrap in another error.
            `Reference ${field} required by file ${file} was nowhere to be found. Did you forget an # import statement?`,
          );
        }
      }
    });
  });

  if (requiresThunkImports) {
    addImport(
      result.vendorImports,
      'VendorImport',
      'graphql',
      'GraphQLResolveInfo',
    );

    addImport(
      result.fileImports,
      'FileImport',
      blossomInstancePath(),
      'RequestContext',
    );
  }

  if (requiresMaybe) {
    addImport(result.vendorImports, 'VendorImport', CORE_PACKAGE_NAME, 'Maybe');
  }

  return result;
}
