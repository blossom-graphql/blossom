/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  ParsedFileGraph,
  ObjectTypeDescriptor,
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
import { blossomInstancePath, typesFilePath } from './paths';
import {
  FileNotFoundInGraph,
  InvalidReferenceError,
  ReferenceNotFoundError,
  LinkingError,
  DuplicateFieldError,
} from './errors';
import { forEachWithErrors, /* fullInspect, */ ErrorsOutput } from './utils';

const CORE_PACKAGE_NAME = '@blossom-gql/core';
const CONTEXT_NAME = 'RequestContext';

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
  dependencyFlags: Map<string, any>;
  enumDeclarations: EnumTypeDescriptor[];
  typeDeclarations: ObjectTypeDescriptor[];
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
  Operation = 'Operation',
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
  | ArgumentOriginDescription
  | OperationOriginDescription;

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

export type OperationOriginDescription = {
  originKind: OriginKind.Operation;
  operationType: SupportedOperation;
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
  parent: ObjectTypeDescriptor,
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
  descriptor: ObjectTypeDescriptor | UnionTypeDescriptor | OperationDescriptor,
): void {
  if (descriptor.kind === 'UnionTypeDescriptor') {
    descriptor.members.forEach(field =>
      addReferenceInGraph(linkingContext.referenceMap, field, {
        originKind: OriginKind.Union,
        name: descriptor.name,
      }),
    );
  } else if (descriptor.kind === 'ObjectTypeDescriptor') {
    descriptor.fields.forEach(field => {
      updateReferenceGraphField(linkingContext, field, descriptor);
    });
  } else if (descriptor.kind === 'OperationDescriptor') {
    addReferenceInGraph(
      linkingContext.referenceMap,
      descriptor.objectType.name,
      {
        originKind: OriginKind.Operation,
        operationType: descriptor.operation,
      },
    );
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
    case OriginKind.Operation:
      return [ElementKind.Type].includes(resolution.elementKind);
  }
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
  _operation: SupportedOperation, // ! Not used at this time.
  _operationTypeName: string,
  _result: TypesFileContents | RootFileContents,
  _linkingContext: LinkingContext,
) {
  // const { linkingType, fileGraph, filePath } = linkingContext;
  // const schemaPath = enforceTypePresence(operationTypeName, linkingContext);
  // // Ensure that the thunk imports are going to be present.
  // if (linkingType === LinkingType.TypesFile && result.kind === 'TypesFile') {
  //   result.requiredDeps.add(THUNK_IMPORTS_DEP_NAME);
  // }
  // const referencePath = schemaPath || filePath;
  // const fileDescriptor = fileGraph.get(referencePath);
  // if (!fileDescriptor) throw new Error('Descriptor not found.'); // TODO: Error.
  // const { parsedDocument } = fileDescriptor;
  // const objectDescriptor = parsedDocument.objects.get(operationTypeName);
  // if (!objectDescriptor) throw new Error('Descriptor not found.'); // TODO: Error.
  // // Add fields to the list of operation declarations.
  // objectDescriptor.fields.forEach(fieldDescriptor => {
  //   const operationDescriptor: OperationDescriptor = {
  //     kind: 'OperationDescriptor',
  //     fieldDescriptor,
  //     operation,
  //   };
  //   const outputType = outputBaseType(operationDescriptor);
  //   if (linkingType === LinkingType.RootFile) {
  //     outputType.kind === 'ReferencedType' &&
  //       addImport(
  //         result.fileImports,
  //         'FileImport',
  //         typesFilePath(filePath),
  //         referencedTypeName(outputType),
  //       );
  //     addImport(
  //       result.fileImports,
  //       'FileImport',
  //       typesFilePath(filePath),
  //       resolverSignatureName(operationDescriptor),
  //     );
  //   }
  //   result.operationDeclarations.push({
  //     kind: 'OperationDescriptor',
  //     fieldDescriptor: {
  //       // We are always forcing these fields to become promises.
  //       ...fieldDescriptor,
  //       thunkType: ThunkType.AsyncFunction,
  //     },
  //     operation,
  //   });
  // });
}

export function linkUnionTypes(
  unionDescriptor: UnionTypeDescriptor,
  result: TypesFileContents,
  _linkingContext: LinkingContext,
) {
  result.unionDeclarations.push(unionDescriptor);
}

export function isRootType(
  fieldName: string,
  linkingContext: LinkingContext,
): boolean {
  for (const operationDescriptor of linkingContext.parsedFile.parsedDocument.operations.values()) {
    if (operationDescriptor.objectType.name === fieldName) return true;
  }

  return false;
}

export function linkObjectTypes(
  typeDescriptor: ObjectTypeDescriptor,
  result: TypesFileContents,
  linkingContext: LinkingContext,
) {
  // Update some of the stats that will be used to compute imports.
  typeDescriptor.fields.some(field => {
    if (field.required) {
      result.dependencyFlags.set('requiredObjectField', true);
    }

    if (field.thunkType !== ThunkType.None) {
      result.dependencyFlags.set('thunkedField', true);
    }

    return (
      result.dependencyFlags.has('requiredObjectField') &&
      result.dependencyFlags.has('thunkedField')
    );
  });

  // We are not adding types if this type is a root value and includeRootTypes
  // option is marked as false.
  if (
    linkingContext.kind === OriginKind.Object &&
    linkingContext.linkingType === LinkingType.TypesFile &&
    isRootType(typeDescriptor.name, linkingContext)
  ) {
    return;
  }

  result.typeDeclarations.push(typeDescriptor);
}

export function addTypesFileImports(
  result: TypesFileContents,
  linkingContext: LinkingContext,
) {
  if (linkingContext.linkingType !== LinkingType.TypesFile) {
    throw new TypeError('Invalid linking type in linking context.');
  }

  // 1. Add vendor imports

  // - When there's a required field, Maybe must be included.
  if (result.dependencyFlags.has('requiredObjectField')) {
    addImport(result.vendorImports, 'VendorImport', CORE_PACKAGE_NAME, 'Maybe');
  }

  // - When there's a thunked field, GraphQLResolveInfo and RequestContext must
  //   be included.
  if (result.dependencyFlags.has('thunkedField')) {
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

  // 2. Add dependencies coming from other files.
  //    For each field, when resolution filePath is different from the filePath
  //    in the current linking context, an import must be created.
  for (const [field, referenceDescription] of linkingContext.referenceMap) {
    // It's already enforced because the enforcing function is called before.
    const resolution = referenceDescription.resolution as ResolutionDescription;

    if (resolution.filePath !== linkingContext.filePath) {
      addImport(
        result.fileImports,
        'FileImport',
        typesFilePath(linkingContext.filePath),
        field, // TODO: Maybe change naming?
      );
    }
  }
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
    dependencyFlags: new Map(),
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

  const operationErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.operations.values()],
    descriptor => {
      updateReferenceMap(linkingContext, descriptor);
    },
  );

  // Find a resolution for each one of the added references.
  resolveReferences(linkingContext);

  const linkingErrors = enforceReferencesPresence(linkingContext);

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

  addTypesFileImports(result, linkingContext);

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
