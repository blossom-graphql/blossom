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
  EnumTypeDescriptor,
  UnionTypeDescriptor,
  FieldDescriptor,
  SupportedOperation,
  TypeDescriptor,
  OperationDescriptor,
  ObjectTypeKind,
} from './parsing';
import { typesFilePath, blossomInstancePath } from './paths';
import {
  FileNotFoundInGraph,
  InvalidReferenceError,
  ReferenceNotFoundError,
  LinkingError,
  DuplicateFieldError,
} from './errors';
import { forEachWithErrors, /* fullInspect, */ ErrorsOutput } from './utils';
import { resolverSignatureName, referencedTypeName } from './naming';

const CORE_PACKAGE_NAME = '@blossom-gql/core';
const CONTEXT_NAME = 'RequestContext';
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
  enumDeclarations: EnumTypeDescriptor[];
  typeDeclarations: ObjectTypeDescription[];
  unionDeclarations: UnionTypeDescriptor[];
  operationDeclarations: OperationDescriptor[];
};

export type RootFileContents = {
  kind: 'RootFile';
  fileImports: ImportGroupMap;
  vendorImports: ImportGroupMap;
  operationDeclarations: OperationDescriptor[];
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
  ObjectArgument = 'ObjectArgument',
  InputArgument = 'InputArgument',
}

export enum ElementKind {
  Type = 'Type',
  Input = 'Input',
  Enum = 'Enum',
  Union = 'Union',
  // Scalar = 'Scalar',
}

export enum PresenceResult {
  Present = 'Present',
  Invalid = 'Invalid',
  NotPresent = 'NotPresent',
}

export enum LinkingType {
  TypesFile = 'TypesFile',
  RootFile = 'RootFile',
}

export type OriginDescription =
  | FieldOriginDescription
  | UnionOriginDescription
  | ArgumentOriginDescription;

export type FieldOriginDescription = {
  fieldName: string;
  objectName: string;
  originKind: OriginKind.Object | OriginKind.Input;
};

export type ArgumentOriginDescription = {
  argumentName: string;
  originKind: OriginKind.ObjectArgument | OriginKind.InputArgument;
  fieldOriginDescription: FieldOriginDescription;
};

export type UnionOriginDescription = {
  name: string;
  originKind: OriginKind.Union;
};

export type ResolutionDescription = {
  filePath: string;
  elementKind: ElementKind;
};

export type ReferenceMap = Map<
  string,
  {
    references: OriginDescription[];
    resolution: ResolutionDescription | undefined;
  }
>;

export type LinkingContext = Readonly<{
  filePath: string;
  fileGraph: ParsedFileGraph;
  kind: OriginKind;
  linkingType: LinkingType;
  parsedFile: ParsedFileDescriptor;
  referenceMap: ReferenceMap;
}>;

export function outputBaseType(
  descriptor: OperationDescriptor | FieldDescriptor,
): TypeDescriptor {
  if (descriptor.kind === 'ArrayFieldDescriptor') {
    return outputBaseType(descriptor.elementDescriptor);
  } else if (descriptor.kind === 'OperationDescriptor') {
    return outputBaseType(descriptor.fieldDescriptor);
  } else {
    return descriptor.type;
  }
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
    enums: document.enums.has(field),
    aliases: false, // document.aliases.has(field)
  };

  switch (originKind) {
    case OriginKind.Object:
    case OriginKind.Union:
    case OriginKind.ObjectArgument:
      return requirePresence(presenceMap, ['objects', 'enums', 'aliases']);
    case OriginKind.Input:
    case OriginKind.InputArgument:
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
      // throw new InvalidReferenceError(typeName, filePath, kind);
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
        // throw new InvalidReferenceError(typeName, filePath, kind);
        case PresenceResult.NotPresent:
        // throw new ReferenceNotFoundError(typeName, filePath);
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
      // throw new InvalidReferenceError(typeName, filePath, kind);
      case PresenceResult.NotPresent:
      // throw new ReferenceNotFoundError(typeName, filePath);
      case PresenceResult.Present:
      default:
        if (!schemaPath) throw new Error('Schema path not found.');

        return schemaPath;
    }
  }

  return undefined;
}

export function addReferenceInGraph(
  referenceMap: ReferenceMap,
  field: string,
  originDescription: OriginDescription,
) {
  const referenceDescription = referenceMap.get(field);
  if (!referenceDescription) {
    referenceMap.set(field, {
      references: [originDescription],
      resolution: undefined,
    });
    return;
  }

  referenceDescription.references.push(originDescription);
}

export function updateReferenceGraphArgument(
  linkingContext: LinkingContext,
  argumentDescriptor: FieldDescriptor,
  fieldOriginDescription: FieldOriginDescription,
) {
  if (argumentDescriptor.kind === 'ArrayFieldDescriptor') {
    updateReferenceGraphArgument(
      linkingContext,
      argumentDescriptor.elementDescriptor,
      fieldOriginDescription,
    );
  } else {
    if (argumentDescriptor.type.kind === 'ReferencedType') {
      const originKind =
        fieldOriginDescription.originKind === OriginKind.Object
          ? OriginKind.ObjectArgument
          : OriginKind.InputArgument;

      addReferenceInGraph(
        linkingContext.referenceMap,
        argumentDescriptor.type.name,
        {
          originKind,
          argumentName: argumentDescriptor.name,
          fieldOriginDescription,
        },
      );
    }
  }
}

export function updateReferenceGraphField(
  linkingContext: LinkingContext,
  descriptor: FieldDescriptor,
  parent: ObjectTypeDescription,
) {
  const originKind: OriginKind.Object | OriginKind.Input =
    parent.objectType === ObjectTypeKind.Object
      ? OriginKind.Object
      : OriginKind.Input;

  const fieldOriginDescription: FieldOriginDescription = {
    originKind,
    fieldName: descriptor.name,
    objectName: parent.name,
  };

  if (descriptor.kind === 'ArrayFieldDescriptor') {
    updateReferenceGraphField(
      linkingContext,
      descriptor.elementDescriptor,
      parent,
    );
  } else {
    if (descriptor.type.kind === 'ReferencedType') {
      addReferenceInGraph(
        linkingContext.referenceMap,
        descriptor.type.name,
        fieldOriginDescription,
      );
    }
  }

  descriptor.arguments &&
    descriptor.arguments.forEach(argumentDescriptor => {
      updateReferenceGraphArgument(
        linkingContext,
        argumentDescriptor,
        fieldOriginDescription,
      );
    });
}

export function updateReferenceMap(
  linkingContext: LinkingContext,
  descriptor: ObjectTypeDescription | UnionTypeDescriptor,
): void {
  if (descriptor.kind === 'UnionTypeDescriptor') {
    descriptor.members.forEach(field =>
      addReferenceInGraph(linkingContext.referenceMap, field, {
        originKind: OriginKind.Union,
        name: descriptor.name,
      }),
    );
  } else if (descriptor.kind === 'ObjectTypeDescription') {
    descriptor.fields.forEach(field => {
      updateReferenceGraphField(linkingContext, field, descriptor);
    });
  }
}

export function ensureResolution(
  referenceMap: ReferenceMap,
  descriptor: { name: string },
  filePath: string,
  elementKind: ElementKind,
) {
  const referenceDescription = referenceMap.get(descriptor.name);
  if (!referenceDescription) return;

  if (referenceDescription.resolution)
    throw new DuplicateFieldError(
      referenceDescription.resolution,
      descriptor.name,
      filePath,
      elementKind,
    );

  referenceDescription.resolution = {
    elementKind,
    filePath,
  };
}

export function resolveDocumentFullReferences(
  referenceMap: ReferenceMap,
  parsedDocument: DocumentParsingOuput,
  filePath: string,
): ErrorsOutput {
  const enumErrors = forEachWithErrors(
    [...parsedDocument.enums.values()],
    enumDescriptor => {
      ensureResolution(
        referenceMap,
        enumDescriptor,
        filePath,
        ElementKind.Enum,
      );
    },
  );

  const objectErrors = forEachWithErrors(
    [...parsedDocument.objects.values()],
    objectDescriptor => {
      ensureResolution(
        referenceMap,
        objectDescriptor,
        filePath,
        ElementKind.Type,
      );
    },
  );

  const inputErrors = forEachWithErrors(
    [...parsedDocument.inputs.values()],
    inputDescriptor => {
      ensureResolution(
        referenceMap,
        inputDescriptor,
        filePath,
        ElementKind.Input,
      );
    },
  );

  const unionErrors = forEachWithErrors(
    [...parsedDocument.unions.values()],
    unionDescriptor => {
      ensureResolution(
        referenceMap,
        unionDescriptor,
        filePath,
        ElementKind.Union,
      );
    },
  );

  return [...enumErrors, ...objectErrors, ...inputErrors, ...unionErrors];
}

export function resolveDocumentNamedReferences(
  referenceMap: ReferenceMap,
  document: DocumentParsingOuput,
  filePath: string,
  field: string,
) {
  const enumDescriptor = document.enums.get(field);
  if (enumDescriptor) {
    ensureResolution(referenceMap, enumDescriptor, filePath, ElementKind.Enum);
    return;
  }

  const objectDescriptor = document.objects.get(field);
  if (objectDescriptor) {
    ensureResolution(
      referenceMap,
      objectDescriptor,
      filePath,
      ElementKind.Type,
    );
    return;
  }

  const inputDescriptor = document.inputs.get(field);
  if (inputDescriptor) {
    ensureResolution(
      referenceMap,
      inputDescriptor,
      filePath,
      ElementKind.Input,
    );
  }

  const unionDescriptor = document.unions.get(field);
  if (unionDescriptor) {
    ensureResolution(
      referenceMap,
      unionDescriptor,
      filePath,
      ElementKind.Union,
    );
  }

  // ! Wasn't found in any of the definitions. That's an error. Should be caught
  // ! by enforceReferencesPresence().
}

export function resolveReferences(
  linkingContext: LinkingContext,
): ErrorsOutput {
  const { referenceMap } = linkingContext;

  // 1. Resolve references in current file
  const sameFileErrors = resolveDocumentFullReferences(
    referenceMap,
    linkingContext.parsedFile.parsedDocument,
    linkingContext.filePath,
  );

  // 2. Resolve references in all full imports
  const fullReferencesErrors = forEachWithErrors(
    [...linkingContext.parsedFile.references.full.keys()],
    filePath => {
      const fileDescriptor = linkingContext.fileGraph.get(
        filePath,
      ) as ParsedFileDescriptor;

      resolveDocumentFullReferences(
        referenceMap,
        fileDescriptor.parsedDocument,
        filePath,
      );
    },
  );

  // 3. Resolve named imports
  const namedReferencesErrors = forEachWithErrors(
    [...linkingContext.parsedFile.references.named.entries()],
    ([filePath, references]) => {
      const { parsedDocument } = linkingContext.fileGraph.get(
        filePath,
      ) as ParsedFileDescriptor;
      const errors = forEachWithErrors([...references.keys()], field =>
        resolveDocumentNamedReferences(
          referenceMap,
          parsedDocument,
          filePath,
          field,
        ),
      );

      if (errors.length > 0) throw new LinkingError(errors);
    },
  );

  return [...sameFileErrors, ...fullReferencesErrors, ...namedReferencesErrors];
}

export function isValidResolution(
  resolution: ResolutionDescription,
  reference: OriginDescription,
): boolean {
  switch (reference.originKind) {
    case OriginKind.Object:
    case OriginKind.ObjectArgument:
      return [ElementKind.Type, ElementKind.Enum, ElementKind.Union].includes(
        resolution.elementKind,
      );
    case OriginKind.Input:
    case OriginKind.InputArgument:
      return [ElementKind.Input, ElementKind.Enum].includes(
        resolution.elementKind,
      );
    case OriginKind.Union:
      return [ElementKind.Type].includes(resolution.elementKind);
  }

  return false;
}

export function enforceReferencesPresence(
  linkingContext: LinkingContext,
): ErrorsOutput {
  // 1. All references must be defined.
  // 2. All references must have matching type.
  return forEachWithErrors(
    [...linkingContext.referenceMap.entries()],
    ([fieldName, referenceDescription]) => {
      if (referenceDescription.references.length === 0) return;

      // Resolution must be present
      if (!referenceDescription.resolution) {
        throw new ReferenceNotFoundError(
          fieldName,
          linkingContext.filePath,
          referenceDescription.references,
        );
      }

      // For each of the references, what's resolved must match
      const errors = forEachWithErrors(
        referenceDescription.references,
        reference => {
          if (
            !isValidResolution(
              referenceDescription.resolution as ResolutionDescription,
              reference,
            )
          ) {
            throw new InvalidReferenceError(
              fieldName,
              linkingContext.filePath,
              reference,
            );
          }
        },
      );

      if (errors.length > 0) throw new LinkingError(errors);
    },
  );
}

export function linkOperationTypes(
  operation: SupportedOperation, // ! Not used at this time.
  operationTypeName: string,
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  const { linkingType, fileGraph, filePath } = linkingContext;
  const schemaPath = enforceTypePresence(operationTypeName, linkingContext);

  // Ensure that the thunk imports are going to be present.
  if (linkingType === LinkingType.TypesFile && result.kind === 'TypesFile') {
    result.requiredDeps.add(THUNK_IMPORTS_DEP_NAME);
  }

  const referencePath = schemaPath || filePath;
  const fileDescriptor = fileGraph.get(referencePath);
  if (!fileDescriptor) throw new Error('Descriptor not found.'); // TODO: Error.

  const { parsedDocument } = fileDescriptor;
  const objectDescriptor = parsedDocument.objects.get(operationTypeName);
  if (!objectDescriptor) throw new Error('Descriptor not found.'); // TODO: Error.

  // Add fields to the list of operation declarations.
  objectDescriptor.fields.forEach(fieldDescriptor => {
    const operationDescriptor: OperationDescriptor = {
      kind: 'OperationDescriptor',
      fieldDescriptor,
      operation,
    };
    const outputType = outputBaseType(operationDescriptor);

    if (linkingType === LinkingType.RootFile) {
      outputType.kind === 'ReferencedType' &&
        addImport(
          result.fileImports,
          'FileImport',
          typesFilePath(filePath),
          referencedTypeName(outputType),
        );

      addImport(
        result.fileImports,
        'FileImport',
        typesFilePath(filePath),
        resolverSignatureName(operationDescriptor),
      );
    }

    result.operationDeclarations.push({
      kind: 'OperationDescriptor',
      fieldDescriptor: {
        // We are always forcing these fields to become promises.
        ...fieldDescriptor,
        thunkType: ThunkType.AsyncFunction,
      },
      operation,
    });
  });
}

export function linkUnionTypes(
  unionDescriptor: UnionTypeDescriptor,
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

  // We are not adding types if this type is a root value and includeRootTypes
  // option is marked as false.
  const isRootType = Object.values(
    linkingContext.parsedFile.parsedDocument.operationNames,
  ).includes(typeDescriptor.name);

  if (
    linkingContext.kind === OriginKind.Object &&
    linkingContext.linkingType === LinkingType.TypesFile &&
    isRootType
  ) {
    return;
  }

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
    filePath,
    fileGraph,
    kind: OriginKind.Object,
    linkingType: LinkingType.TypesFile,
    parsedFile,
    referenceMap: new Map(),
  };

  // Link every object
  const objectErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.objects.values()],
    descriptor => {
      updateReferenceMap(linkingContext, descriptor);

      linkObjectTypes(descriptor, result, {
        ...linkingContext,
        kind: OriginKind.Object,
      });
    },
  );

  const inputErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.inputs.values()],
    descriptor => {
      updateReferenceMap(linkingContext, descriptor);

      linkObjectTypes(descriptor, result, {
        ...linkingContext,
        kind: OriginKind.Input,
      });
    },
  );

  // Push enums. If this gets more complicated, a new function can be created.
  [...parsedFile.parsedDocument.enums.values()].forEach(descriptor => {
    result.enumDeclarations.push(descriptor);
  });

  // Push unions.
  const unionErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.unions.values()],
    descriptor => {
      updateReferenceMap(linkingContext, descriptor);

      linkUnionTypes(descriptor, result, {
        ...linkingContext,
        kind: OriginKind.Union,
      });
    },
  );

  resolveReferences(linkingContext);
  const linkingErrors = enforceReferencesPresence(linkingContext);
  // console.log(fullInspect(linkingContext.referenceMap));

  // Check for operation names. When that's the case, the underlying types must
  // be found (not necessarily in the same document), check whether they are
  // object types and store their location
  const operationsTuples = Object.entries(
    parsedFile.parsedDocument.operationNames,
  ) as ReadonlyArray<[SupportedOperation, string]>;

  const operationErrors = options.parseRootOperations
    ? forEachWithErrors(
        operationsTuples,
        ([operationName, operationType]: [SupportedOperation, string]) =>
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
    ...linkingErrors,
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
      CONTEXT_NAME,
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
    vendorImports: new Map(),
    operationDeclarations: [],
  };

  const linkingContext: LinkingContext = {
    filePath,
    fileGraph,
    kind: OriginKind.Object,
    linkingType: LinkingType.RootFile,
    parsedFile,
    referenceMap: new Map(),
  };

  const operationTuples = Object.entries(
    parsedFile.parsedDocument.operationNames,
  ) as ReadonlyArray<[SupportedOperation, string]>;

  operationTuples.forEach(([operation, operationTypeName]) => {
    if (!operationTypeName) return;

    linkOperationTypes(operation, operationTypeName, result, linkingContext);
  });

  addImport(
    result.vendorImports,
    'VendorImport',
    CORE_PACKAGE_NAME,
    CONTEXT_NAME,
  );

  return result;
}
