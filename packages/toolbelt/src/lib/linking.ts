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
  EnumTypeDescription,
  UnionTypeDescription,
  FieldDescriptor,
} from './parsing';
import { typesFilePath, blossomInstancePath } from './paths';
import {
  FileNotFoundInGraph,
  InvalidReferenceError,
  ReferenceNotFoundError,
  LinkingError,
} from './errors';
import { forEachWithErrors } from './utils';
import { resolverSignatureName } from './naming';

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
  kind: 'TypesFile';
  vendorImports: ImportGroupMap;
  fileImports: ImportGroupMap;
  requiredDeps: Set<string>;
  enumDeclarations: EnumTypeDescription[];
  typeDeclarations: ObjectTypeDescription[];
  unionDeclarations: UnionTypeDescription[];
  operationDeclarations: FieldDescriptor[];
};

export type RootFileContents = {
  kind: 'RootFile';
  fileImports: ImportGroupMap;
  operationDeclarations: FieldDescriptor[];
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
  Union = 'Union',
}

export enum PresenceResult {
  Present = 'Present',
  Invalid = 'Invalid',
  NotPresent = 'NotPresent',
}

export type LinkingContext = Readonly<{
  addImports: boolean;
  filePath: string;
  fileGraph: ParsedFileGraph;
  parsedFile: ParsedFileDescriptor;
  kind: OriginKind;
}>;

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
    enums: document.enums.has(field),
    aliases: false, // document.aliases.has(field)
  };

  switch (originKind) {
    case OriginKind.Object:
    case OriginKind.Union:
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

export function enforceTypePresence(
  typeName: string,
  linkingContext: LinkingContext,
): string | undefined {
  const {
    fileGraph,
    filePath,
    kind,
    parsedFile,
    parsedFile: { parsedDocument },
  } = linkingContext;

  const presenceInSameDocument = documentHasReference(
    parsedDocument,
    kind,
    typeName,
  );

  // 1. Search in the object.
  if (presenceInSameDocument !== PresenceResult.NotPresent) {
    if (presenceInSameDocument === PresenceResult.Invalid) {
      throw new InvalidReferenceError(typeName, filePath, kind);
    } else {
      // Linking passed. Nothing to do here because it's already on the file.
      // TODO: Log
      return undefined;
    }
  } else {
    // 2. Search in references explicitly.
    const existingRef = [...parsedFile.references.named.entries()].find(
      ([_, map]) => map.has(typeName),
    );

    // Reference found. Ensure that the file is readily available and that
    // the reference can actually be imported.
    if (existingRef) {
      const [schemaPath] = existingRef;

      switch (
        fileHasReference(fileGraph, filePath, schemaPath, kind, typeName)
      ) {
        case PresenceResult.Present:
          return schemaPath;
        case PresenceResult.Invalid:
          throw new InvalidReferenceError(typeName, filePath, kind);
        case PresenceResult.NotPresent:
          throw new ReferenceNotFoundError(typeName, filePath);
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
        typeName,
      );

      if (result !== PresenceResult.NotPresent) {
        presenceResult = result;
        schemaPath = referencedSchemaPath;
        break;
      }
    }

    // TODO: Log
    switch (presenceResult) {
      case PresenceResult.Invalid:
        throw new InvalidReferenceError(typeName, filePath, kind);
      case PresenceResult.NotPresent:
        throw new ReferenceNotFoundError(typeName, filePath);
      case PresenceResult.Present:
      default:
        if (!schemaPath) throw new Error('Schema path not found.');

        return schemaPath;
    }
  }
}

export function linkOperationTypes(
  _operationName: string, // ! Not used at this time.
  operationTypeName: string,
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  const { addImports, fileGraph, filePath } = linkingContext;
  const schemaPath = enforceTypePresence(operationTypeName, linkingContext);

  if (schemaPath && addImports) {
    addImport(
      result.fileImports,
      'FileImport',
      typesFilePath(schemaPath),
      operationTypeName,
    );
  }

  // Ensure that the thunk imports are going to be present.
  if (addImports && result.kind === 'TypesFile') {
    result.requiredDeps.add(THUNK_IMPORTS_DEP_NAME);
  }

  const referencePath = schemaPath || filePath;
  const fileDescriptor = fileGraph.get(referencePath);
  if (!fileDescriptor) throw new Error('Descriptor not found.'); // TODO: Error.

  const { parsedDocument } = fileDescriptor;
  const objectDescriptor = parsedDocument.objects.get(operationTypeName);
  if (!objectDescriptor) throw new Error('Descriptor not found.'); // TODO: Error.

  // Add fields to the list of operation declarations.
  objectDescriptor.fields.forEach(field => {
    // We are always forcing these fields to become promises.
    result.operationDeclarations.push({
      ...field,
      thunkType: ThunkType.AsyncFunction,
    });
  });
}

export function linkUnionTypes(
  unionDescriptor: UnionTypeDescription,
  result: TypesFileContents,
  linkingContext: LinkingContext,
) {
  const errors = forEachWithErrors(
    [...unionDescriptor.referencedTypes],
    typeName => {
      const schemaPath = enforceTypePresence(typeName, linkingContext);

      if (schemaPath)
        addImport(
          result.fileImports,
          'FileImport',
          typesFilePath(schemaPath),
          typeName,
        );
    },
  );

  if (errors.length > 0) throw new LinkingError(errors);

  result.unionDeclarations.push(unionDescriptor);
}

export function linkObjectTypes(
  typeDescriptor: ObjectTypeDescription,
  result: TypesFileContents,
  linkingContext: LinkingContext,
) {
  const { kind } = linkingContext;

  // Calculate whether Maybe should be required or not.
  if (
    !result.requiredDeps.has(MAYBE_DEP_NAME) &&
    typeDescriptor.fields.find(field => !field.required)
  )
    result.requiredDeps.add(MAYBE_DEP_NAME);

  // Calculate whether ThunkImports should be required or not.
  if (
    kind === OriginKind.Object &&
    !result.requiredDeps.has(THUNK_IMPORTS_DEP_NAME) &&
    typeDescriptor.fields.find(field => field.thunkType !== ThunkType.None)
  )
    result.requiredDeps.add(THUNK_IMPORTS_DEP_NAME);

  // Ensure that dependencies can be satisfied for each field.
  const errors = forEachWithErrors(
    [...typeDescriptor.referencedTypes],
    field => {
      const schemaPath = enforceTypePresence(field, linkingContext);

      // Nothing thrown on enforceFieldPresence. Add to imports list only when
      // the path is specified. Otherwise the import is on the same file.
      if (schemaPath)
        addImport(
          result.fileImports,
          'FileImport',
          typesFilePath(schemaPath),
          field,
        );
    },
  );

  if (errors.length > 0) throw new LinkingError(errors);

  // Append to the list of type declarations.
  result.typeDeclarations.push(typeDescriptor);
}

export function linkTypesFile(
  filePath: string,
  fileGraph: ParsedFileGraph,
  options: { parseRootOperations: boolean } = { parseRootOperations: true },
): TypesFileContents {
  const parsedFile = fileGraph.get(filePath);
  if (!parsedFile) {
    throw new FileNotFoundInGraph(filePath);
  }

  const result: TypesFileContents = {
    kind: 'TypesFile',
    vendorImports: new Map(),
    fileImports: new Map(),
    requiredDeps: new Set(),
    typeDeclarations: [],
    enumDeclarations: [],
    unionDeclarations: [],
    operationDeclarations: [],
  };

  const linkingContext: LinkingContext = {
    addImports: true,
    filePath,
    fileGraph,
    parsedFile,
    kind: OriginKind.Object,
  };

  // Link every object
  const objectErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.objects.values()],
    descriptor =>
      linkObjectTypes(descriptor, result, {
        ...linkingContext,
        kind: OriginKind.Object,
      }),
  );

  const inputErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.inputs.values()],
    descriptor =>
      linkObjectTypes(descriptor, result, {
        ...linkingContext,
        kind: OriginKind.Input,
      }),
  );

  // Push enums. If this gets more complicated, a new function can be created.
  [...parsedFile.parsedDocument.enums.values()].forEach(descriptor => {
    result.enumDeclarations.push(descriptor);
  });

  // Push unions.
  const unionErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.unions.values()],
    descriptor =>
      linkUnionTypes(descriptor, result, {
        ...linkingContext,
        kind: OriginKind.Union,
      }),
  );

  // Check for operation names. When that's the case, the underlying types must
  // be found (not necessarily in the same document), check whether they are
  // object types and store their location
  const operationErrors = options.parseRootOperations
    ? forEachWithErrors(
        Object.entries(parsedFile.parsedDocument.operationNames),
        ([operationName, operationType]: [string, string | undefined]) =>
          operationType &&
          linkOperationTypes(
            operationName,
            operationType,
            result,
            linkingContext,
          ),
      )
    : [];

  // Show errors
  const accumulatedErrors = [
    ...objectErrors,
    ...inputErrors,
    ...unionErrors,
    ...operationErrors,
  ];

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

export function linkRootFile(
  filePath: string,
  fileGraph: ParsedFileGraph,
): RootFileContents {
  const parsedFile = fileGraph.get(filePath);
  if (!parsedFile) {
    throw new FileNotFoundInGraph(filePath);
  }

  const result: RootFileContents = {
    kind: 'RootFile',
    fileImports: new Map(),
    operationDeclarations: [],
  };

  const linkingContext: LinkingContext = {
    addImports: false,
    filePath,
    fileGraph,
    parsedFile,
    kind: OriginKind.Object,
  };

  Object.entries(parsedFile.parsedDocument.operationNames).forEach(
    ([operationName, operationTypeName]) => {
      if (!operationTypeName) return;

      addImport(
        result.fileImports,
        'FileImport',
        typesFilePath(filePath),
        'Test', // TODO: CHANGE ME
      );

      addImport(
        result.fileImports,
        'FileImport',
        typesFilePath(filePath),
        resolverSignatureName(operationTypeName),
      );

      linkOperationTypes(
        operationName,
        operationTypeName,
        result,
        linkingContext,
      );
    },
  );

  return result;
}
