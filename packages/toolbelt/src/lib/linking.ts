/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  ParsedFileGraph,
  ObjectTypeDescription,
  ThunkType,
  DocumentParsingOuput,
  ParsedFileDescriptor,
} from './parsing';
import { typesFilePath, blossomInstancePath } from './paths';
import {
  FileNotFoundInGraph,
  InvalidReferenceError,
  ReferenceNotFoundError,
  LinkingError,
} from './errors';
import { forEachWithErrors } from './utils';

const CORE_PACKAGE_NAME = '@blossom-gql/core';
const MAYBE_DEP_NAME = 'Maybe';
const THUNK_IMPORTS_DEP_NAME = 'ThunkImports';

type ImportMembersMap = Map<'default' | string, string | undefined>;

export type ImportDescription = VendorImportDescription | FileImportDescription;

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
  requiredDeps: Set<string>;
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

export enum OriginKind {
  Object = 'Object',
  Input = 'Input',
  Alias = 'Alias',
}

export enum PresenceResult {
  Present = 'Present',
  Invalid = 'Invalid',
  NotPresent = 'NotPresent',
}

export function requirePresence(presenceMap: any, keys: string[]) {
  const hasValidKey = !!keys.find(key => presenceMap[key]);
  if (hasValidKey) return PresenceResult.Present;

  if (keys.length > Object.keys(presenceMap).length) {
    return PresenceResult.NotPresent;
  } else if (Object.values(presenceMap).find(value => !!value)) {
    return PresenceResult.Invalid;
  } else {
    return PresenceResult.NotPresent;
  }
}

export function documentHasReference(
  document: DocumentParsingOuput,
  originKind: OriginKind,
  field: string,
): PresenceResult {
  // Only one of these should be true. If there's more than one, that's a parsing
  // bug for sure.
  const presenceMap = {
    objects: document.objects.has(field),
    inputs: document.inputs.has(field),
    enums: false, // document.enums.has(field)
    aliases: false, // document.aliases.has(field)
  };

  switch (originKind) {
    case OriginKind.Object:
    case OriginKind.Alias:
      return requirePresence(presenceMap, ['objects', 'enums', 'aliases']);
    case OriginKind.Input:
      return requirePresence(presenceMap, ['inputs', 'enums']);
  }
}

export function fileHasReference(
  fileGraph: ParsedFileGraph,
  filePath: string,
  schemaPath: string,
  kind: OriginKind,
  field: string,
): PresenceResult {
  const referencedFile = fileGraph.get(schemaPath);
  if (!referencedFile) throw new FileNotFoundInGraph(filePath);

  const { parsedDocument: referencedDocument } = referencedFile;
  return documentHasReference(referencedDocument, kind, field);
}

export function linkTypes(state: {
  descriptor: ObjectTypeDescription;
  result: TypesFileContents;
  filePath: string;
  fileGraph: ParsedFileGraph;
  parsedFile: ParsedFileDescriptor;
  kind: OriginKind;
}) {
  const {
    descriptor,
    fileGraph,
    kind,
    filePath,
    parsedFile,
    parsedFile: { parsedDocument },
    result,
  } = state;

  // Calculate whether Maybe should be required or not.
  if (
    !result.requiredDeps.has(MAYBE_DEP_NAME) &&
    descriptor.fields.find(field => !field.required)
  )
    result.requiredDeps.add(MAYBE_DEP_NAME);

  // Calculate whether ThunkImports should be required or not.
  if (
    !result.requiredDeps.has(THUNK_IMPORTS_DEP_NAME) &&
    descriptor.fields.find(field => field.thunkType !== ThunkType.None)
  )
    result.requiredDeps.add(THUNK_IMPORTS_DEP_NAME);

  // Ensure that dependencies can be satisfied for each field.
  descriptor.referencedTypes.forEach(field => {
    const presenceInSameDocument = documentHasReference(
      parsedDocument,
      kind,
      field,
    );

    // 1. Search in the object.
    if (presenceInSameDocument !== PresenceResult.NotPresent) {
      if (presenceInSameDocument === PresenceResult.Invalid) {
        throw new InvalidReferenceError(field, filePath, kind);
      } else {
        // Linking passed. Nothing to do here because it's already on the file.
        // TODO: Log
        return;
      }
    } else {
      // 2. Search in references explicitly.
      const existingRef = [...parsedFile.references.named.entries()].find(
        ([_, map]) => map.has(field),
      );

      // Reference found. Ensure that the file is readily available and that
      // the reference can actually be imported.
      if (existingRef) {
        const [schemaPath] = existingRef;

        switch (
          fileHasReference(fileGraph, filePath, schemaPath, kind, field)
        ) {
          case PresenceResult.Present:
            addImport(
              result.fileImports,
              'FileImport',
              typesFilePath(schemaPath),
              field,
            );
            return;
          case PresenceResult.Invalid:
            throw new InvalidReferenceError(field, filePath, kind);
          case PresenceResult.NotPresent:
            throw new ReferenceNotFoundError(field, filePath);
        }
      }

      // 3. Search in references with wildcards.
      let schemaPath: string | undefined;
      let presenceResult: PresenceResult = PresenceResult.NotPresent;

      for (const referencedSchemaPath of parsedFile.references.full) {
        const result = fileHasReference(
          fileGraph,
          filePath,
          referencedSchemaPath,
          kind,
          field,
        );

        if (result !== PresenceResult.NotPresent) {
          presenceResult = result;
          schemaPath = referencedSchemaPath;
          break;
        }
      }

      // TODO: Log
      switch (presenceResult) {
        case PresenceResult.Present:
          if (!schemaPath) throw new Error('Schema path not found.');

          addImport(
            result.fileImports,
            'FileImport',
            typesFilePath(schemaPath),
            field,
          );
          return;
        case PresenceResult.Invalid:
          throw new InvalidReferenceError(field, filePath, kind);
        case PresenceResult.NotPresent:
          throw new ReferenceNotFoundError(field, filePath);
      }
    }
  });

  // Append to the list of type declarations.
  result.typeDeclarations.push(descriptor);
}

export function linkTypesFile(
  filePath: string,
  fileGraph: ParsedFileGraph,
): TypesFileContents {
  const parsedFile = fileGraph.get(filePath);
  if (!parsedFile) {
    throw new FileNotFoundInGraph(filePath);
  }

  const result: TypesFileContents = {
    vendorImports: new Map(),
    fileImports: new Map(),
    typeDeclarations: [],
    requiredDeps: new Set(),
  };

  // Link every object
  const objectErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.objects.values()],
    descriptor =>
      linkTypes({
        descriptor,
        result,
        filePath,
        fileGraph,
        parsedFile,
        kind: OriginKind.Object,
      }),
  );

  const inputErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.inputs.values()],
    descriptor =>
      linkTypes({
        descriptor,
        result,
        filePath,
        fileGraph,
        parsedFile,
        kind: OriginKind.Input,
      }),
  );

  const accumulatedErrors = [...objectErrors, ...inputErrors];

  if (accumulatedErrors.length > 0) {
    throw new LinkingError(accumulatedErrors);
  }

  // If we have any thunked schema file, add the corresponding imports.
  const requiresThunkImports = result.requiredDeps.has(THUNK_IMPORTS_DEP_NAME);
  const requiresMaybe = result.requiredDeps.has(MAYBE_DEP_NAME);

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

  // If we have any optional type, import Maybe type definition.
  if (requiresMaybe) {
    addImport(result.vendorImports, 'VendorImport', CORE_PACKAGE_NAME, 'Maybe');
  }

  return result;
}
