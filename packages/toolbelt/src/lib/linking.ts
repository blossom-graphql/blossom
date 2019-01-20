/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  DocumentParsingOuput,
  EnumTypeDescriptor,
  FieldDescriptor,
  ObjectTypeDescriptor,
  ObjectTypeKind,
  OperationDescriptor,
  OperationFieldDescriptor,
  ParsedFileDescriptor,
  ParsedFileGraph,
  SupportedOperation,
  ThunkType,
  TypeDescriptor,
  UnionTypeDescriptor,
  KnownScalarTypes,
} from './parsing';
import { blossomInstancePath, typesFilePath, resolversFilePath } from './paths';
import {
  FileNotFoundInGraph,
  InvalidReferenceError,
  ReferenceNotFoundError,
  LinkingError,
  DuplicateFieldError,
  EmptyLoadersFileError,
} from './errors';
import { forEachWithErrors, /* fullInspect, */ ErrorsOutput } from './utils';
import {
  rootResolverSignatureName,
  resolverName,
  referencedTypeName,
} from './naming';

export const GRAPHQL_PACKAGE_NAME = 'graphql';
export const CORE_PACKAGE_NAME = '@blossom-gql/core';
export const CORE_RESOLVE_NAME = 'resolve';
export const CORE_CONTEXT_NAME = 'RequestContext';
export const CORE_BATCHFN_NAME = 'BatchFunction';
export const CORE_RESOLVER_NAME = 'Resolver';
export const INSTANCE_ROOT_QUERY_NAME = 'RootQuery';
export const INSTANCE_ROOT_MUTATION_NAME = 'RootMutation';
export const MAYBE_NAME = 'Maybe';
export const PRIME_NAME = 'prime';

export const QUERY_SIGNATURE_NAME = 'QueryResolverSignature';
export const MUTATION_SIGNATURE_NAME = 'MutationResolverSignature';
export const OBJECT_SIGNATURE_NAME = 'ObjectSignatureName';

export enum DependencyFlag {
  HasOptionalReference = 'HasOptionalReference',
  HasThunkedField = 'HasThunkedField',
  HasQuerySignatures = 'HasQuerySignatures',
  HasMutationSignatures = 'HasMutationSignatures',
  HasReferencedTypeOperation = 'HasReferencedTypeOperation',
  HasRootQuery = 'HasRootQuery',
  HasRootMutation = 'HasRootMutation',
}

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
  dependencyFlags: Map<DependencyFlag, any>;
  enumDeclarations: EnumTypeDescriptor[];
  typeDeclarations: ObjectTypeDescriptor[];
  unionDeclarations: UnionTypeDescriptor[];
  operationDeclarations: OperationFieldDescriptor[];
};

export type RootFileContents = {
  kind: 'RootFile';
  fileImports: ImportGroupMap;
  vendorImports: ImportGroupMap;
  dependencyFlags: Map<DependencyFlag, any>;
  operationDeclarations: OperationFieldDescriptor[];
};

export type SourcesFileContents = {
  kind: 'SourcesFile';
  fileImports: ImportGroupMap;
  vendorImports: ImportGroupMap;
  batchFnDeclarations: {
    objectDescriptor: ObjectTypeDescriptor;
    idFields: FieldDescriptor[];
  }[];
};

export type ResolversFileContents = {
  kind: 'ResolversFile';
  fileImports: ImportGroupMap;
  vendorImports: ImportGroupMap;
  typeDeclarations: ObjectTypeDescriptor[];
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
  SourcesFile = 'SourcesFile',
  ResolversFile = 'ResolversFile',
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
  descriptor: OperationFieldDescriptor | FieldDescriptor,
): TypeDescriptor {
  if (descriptor.kind === 'ArrayFieldDescriptor') {
    return outputBaseType(descriptor.elementDescriptor);
  } else if (descriptor.kind === 'OperationFieldDescriptor') {
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

export function addFieldCommonDependencyFlags(
  field: FieldDescriptor,
  result: TypesFileContents | RootFileContents,
) {
  if (!field.required) {
    result.dependencyFlags.set(DependencyFlag.HasOptionalReference, true);
  }

  if (field.thunkType !== ThunkType.None) {
    result.dependencyFlags.set(DependencyFlag.HasThunkedField, true);
  }
}

export function extractDescriptor(
  fieldName: string,
  elementKind: ElementKind.Type,
  linkingContext: LinkingContext,
): ObjectTypeDescriptor | undefined;
export function extractDescriptor(
  fieldName: string,
  elementKind: ElementKind.Input,
  linkingContext: LinkingContext,
): ObjectTypeDescriptor | undefined;
export function extractDescriptor(
  fieldName: string,
  elementKind: ElementKind.Enum,
  linkingContext: LinkingContext,
): EnumTypeDescriptor | undefined;
export function extractDescriptor(
  fieldName: string,
  elementKind: ElementKind.Union,
  linkingContext: LinkingContext,
): UnionTypeDescriptor | undefined;
export function extractDescriptor(
  fieldName: string,
  elementKind: ElementKind,
  linkingContext: LinkingContext,
): ObjectTypeDescriptor | EnumTypeDescriptor | UnionTypeDescriptor | undefined {
  const { referenceMap } = linkingContext;

  const referenceDescriptor = referenceMap.get(fieldName);
  if (!referenceDescriptor) {
    // Descriptor must exist.
    throw new Error('Name not found.'); // TODO: Internal.
  }
  if (!referenceDescriptor.resolution) {
    // Must be resolved.
    throw new Error(`Field ${fieldName} not resolved.`); // TODO: Internal.
  }
  if (referenceDescriptor.resolution.elementKind !== ElementKind.Type) {
    // Must be Object type.
    throw new Error(`${fieldName} is not an object type.`); // TODO: Internal.
  }

  // Extract definition from the file given by the path
  const { fileGraph } = linkingContext;
  const parsedFile = fileGraph.get(referenceDescriptor.resolution.filePath);
  if (!parsedFile) {
    throw new Error('Parsed file not found.'); // TODO: Internal.
  }

  const { parsedDocument } = parsedFile;
  switch (elementKind) {
    case ElementKind.Type:
      return parsedDocument.objects.get(fieldName);
    case ElementKind.Input:
      return parsedDocument.inputs.get(fieldName);
    case ElementKind.Enum:
      return parsedDocument.enums.get(fieldName);
    case ElementKind.Union:
      return parsedDocument.unions.get(fieldName);
  }
}

export function linkOperationTypes(
  descriptor: OperationDescriptor,
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  // 1. Get object type definition from resolved map. Ensure that exists.
  const { name } = descriptor.objectType;

  const objectDescriptor = extractDescriptor(
    name,
    ElementKind.Type,
    linkingContext,
  );
  if (!objectDescriptor) {
    throw new Error(`Object descriptor not found for name ${name}.`);
  }

  // 2. Create descriptor for each one of the fields.
  objectDescriptor.fields.forEach(field => {
    let fieldDescriptor: FieldDescriptor;
    if (linkingContext.linkingType === LinkingType.RootFile) {
      fieldDescriptor = {
        ...field,
        thunkType: ThunkType.AsyncFunction,
      };
    } else {
      fieldDescriptor = field;
    }

    addFieldCommonDependencyFlags(fieldDescriptor, result);

    const operationFieldDescriptor: OperationFieldDescriptor = {
      ...descriptor,
      kind: 'OperationFieldDescriptor',
      fieldDescriptor,
    };

    result.operationDeclarations.push(operationFieldDescriptor);

    if (outputBaseType(fieldDescriptor).kind === 'ReferencedType') {
      result.dependencyFlags.set(
        DependencyFlag.HasReferencedTypeOperation,
        true,
      );
    }
  });

  if (descriptor.operation === SupportedOperation.Query) {
    result.dependencyFlags.set(DependencyFlag.HasRootQuery, true);
  } else if (descriptor.operation === SupportedOperation.Mutation) {
    result.dependencyFlags.set(DependencyFlag.HasRootMutation, true);
  }

  // 3. Add dependency flags for properly resolving imports when we are
  //    generating a types file.
  if (linkingContext.linkingType !== LinkingType.TypesFile) return;

  if (descriptor.operation === SupportedOperation.Query) {
    result.dependencyFlags.set(DependencyFlag.HasQuerySignatures, true);
  } else if (descriptor.operation === SupportedOperation.Mutation) {
    result.dependencyFlags.set(DependencyFlag.HasMutationSignatures, true);
  }
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
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  // Update some of the stats that will be used to compute imports.
  typeDescriptor.fields.some(field => {
    addFieldCommonDependencyFlags(field, result);

    return (
      result.dependencyFlags.has(DependencyFlag.HasOptionalReference) &&
      result.dependencyFlags.has(DependencyFlag.HasThunkedField)
    );
  });

  // We are not adding types if this type is a root value and we are creating
  // a types file.
  //
  // TODO: Make it optional maybe?
  if (
    linkingContext.kind === OriginKind.Object &&
    linkingContext.linkingType === LinkingType.TypesFile &&
    isRootType(typeDescriptor.name, linkingContext)
  ) {
    return;
  }

  if (result.kind === 'TypesFile') {
    result.typeDeclarations.push(typeDescriptor);
  }
}

export function addCommonVendorImports(
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  // - When there's a required field, Maybe must be included.
  if (result.dependencyFlags.has(DependencyFlag.HasOptionalReference)) {
    addImport(
      result.vendorImports,
      'VendorImport',
      CORE_PACKAGE_NAME,
      MAYBE_NAME,
    );
  }

  // - When there's a thunked field, GraphQLResolveInfo and RequestContext must
  //   be included.
  if (result.dependencyFlags.get(DependencyFlag.HasThunkedField)) {
    // addImport(
    //   result.vendorImports,
    //   'VendorImport',
    //   GRAPHQL_PACKAGE_NAME,
    //   'GraphQLResolveInfo',
    // );

    addImport(
      result.fileImports,
      'FileImport',
      blossomInstancePath(),
      CORE_CONTEXT_NAME,
    );
  }

  // - Include signatures when they are present in the file
  if (result.dependencyFlags.get(DependencyFlag.HasQuerySignatures)) {
    addImport(
      result.vendorImports,
      'VendorImport',
      CORE_PACKAGE_NAME,
      QUERY_SIGNATURE_NAME,
    );
  }

  if (result.dependencyFlags.get(DependencyFlag.HasMutationSignatures)) {
    addImport(
      result.vendorImports,
      'VendorImport',
      CORE_PACKAGE_NAME,
      MUTATION_SIGNATURE_NAME,
    );
  }

  if (
    linkingContext.linkingType === LinkingType.TypesFile &&
    result.dependencyFlags.get(DependencyFlag.HasThunkedField)
  ) {
    addImport(
      result.vendorImports,
      'VendorImport',
      CORE_PACKAGE_NAME,
      OBJECT_SIGNATURE_NAME,
    );
  }
}

export function addTypeReferencesImports(
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  // For each field, when resolution filePath is different from the filePath
  // in the current linking context, an import must be created.
  for (const [field, referenceDescription] of linkingContext.referenceMap) {
    // It's already enforced because the enforcing function is called before.
    const resolution = referenceDescription.resolution as ResolutionDescription;

    // Don't add the import if we are generating a types file and the files
    // paths match.
    if (
      linkingContext.linkingType === LinkingType.TypesFile &&
      resolution.filePath === linkingContext.filePath
    )
      continue;

    // Don't add the import if we are generating a root file and the reference
    // is to one of the root types.
    if (
      linkingContext.linkingType === LinkingType.RootFile &&
      isRootType(field, linkingContext)
    )
      continue;

    addImport(
      result.fileImports,
      'FileImport',
      typesFilePath(resolution.filePath),
      referencedTypeName(field),
    );
  }
}

export function addTypesFileImports(
  result: TypesFileContents,
  linkingContext: LinkingContext,
) {
  if (linkingContext.linkingType !== LinkingType.TypesFile) {
    throw new TypeError('Invalid linking type in linking context.');
  }

  // 1. Add vendor imports
  addCommonVendorImports(result, linkingContext);

  // 2. Add dependencies coming from other files.
  addTypeReferencesImports(result, linkingContext);
}

export function addRootFileImports(
  result: RootFileContents,
  linkingContext: LinkingContext,
) {
  // 1. Add common vendor imports.
  addCommonVendorImports(result, linkingContext);

  // 2. Add resolve import when necessary
  if (result.dependencyFlags.get(DependencyFlag.HasReferencedTypeOperation))
    addImport(
      result.vendorImports,
      'VendorImport',
      CORE_PACKAGE_NAME,
      CORE_RESOLVE_NAME,
    );

  if (result.dependencyFlags.get(DependencyFlag.HasRootQuery))
    addImport(
      result.fileImports,
      'FileImport',
      blossomInstancePath(),
      INSTANCE_ROOT_QUERY_NAME,
    );

  if (result.dependencyFlags.get(DependencyFlag.HasRootMutation))
    addImport(
      result.fileImports,
      'FileImport',
      blossomInstancePath(),
      INSTANCE_ROOT_MUTATION_NAME,
    );

  // 3. Add dependencies coming from other files.
  addTypeReferencesImports(result, linkingContext);

  // 4. Add resolver signatures imports.
  result.operationDeclarations.forEach(operationFieldDescriptor => {
    addImport(
      result.fileImports,
      'FileImport',
      typesFilePath(linkingContext.filePath),
      rootResolverSignatureName(operationFieldDescriptor),
    );

    const outputType = outputBaseType(operationFieldDescriptor);
    if (outputType.kind === 'ReferencedType') {
      addImport(
        result.fileImports,
        'FileImport',
        resolversFilePath(linkingContext.filePath),
        resolverName(outputType.name),
      );
    }
  });
}

export function addSourcesFileImports(
  result: SourcesFileContents,
  _linkingContext: LinkingContext,
) {
  // Loaders signatures should always import maybe and prime.
  addImport(
    result.vendorImports,
    'VendorImport',
    CORE_PACKAGE_NAME,
    MAYBE_NAME,
  );

  addImport(
    result.vendorImports,
    'VendorImport',
    CORE_PACKAGE_NAME,
    PRIME_NAME,
  );

  addImport(
    result.vendorImports,
    'VendorImport',
    CORE_PACKAGE_NAME,
    CORE_BATCHFN_NAME,
  );
}

export function addResolversFileImports(
  result: ResolversFileContents,
  linkingContext: LinkingContext,
) {
  addImport(
    result.vendorImports,
    'VendorImport',
    CORE_PACKAGE_NAME,
    CORE_RESOLVER_NAME,
  );

  // For each of the types import the definition from types file
  result.typeDeclarations.forEach(objectDescriptor => {
    addImport(
      result.fileImports,
      'FileImport',
      typesFilePath(linkingContext.filePath),
      referencedTypeName(objectDescriptor.name),
    );
  });
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

  // Resolve operation fields
  const operationLinkingErrors = forEachWithErrors(
    [...parsedFile.parsedDocument.operations.values()],
    descriptor => {
      linkOperationTypes(descriptor, result, linkingContext);
    },
  );

  // Show errors
  const accumulatedErrors = [
    ...objectErrors,
    ...inputErrors,
    ...unionErrors,
    ...linkingErrors,
    ...operationErrors,
    ...operationLinkingErrors,
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
    dependencyFlags: new Map(),
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

  // Ensure that all the references for operations are resolved
  // Object errors must be included among the references because that way we
  // guarantee the resolution of outputs and arguments.
  const accumulatedErrors: [number, Error][] = [];

  accumulatedErrors.push(
    ...forEachWithErrors(
      [...parsedFile.parsedDocument.operations.values()],
      descriptor => {
        updateReferenceMap(linkingContext, descriptor);
      },
    ),
  );

  resolveReferences(linkingContext);
  accumulatedErrors.push(...enforceReferencesPresence(linkingContext));

  // Freeze keys since updateReferenceMap is going to mutate referenceMap.
  const keys = [...linkingContext.referenceMap.keys()];
  for (const field of keys) {
    // Guard, because enforeReferencesPresence guarantees us that this is
    // resolved.
    const objectDescriptor = extractDescriptor(
      field,
      ElementKind.Type,
      linkingContext,
    );
    if (!objectDescriptor) throw new Error('Type not found.'); // TODO: Internal

    updateReferenceMap(linkingContext, objectDescriptor);
  }

  // Resolve and ensure again, now that we have the requirements of the object
  // descriptors.
  resolveReferences(linkingContext);
  accumulatedErrors.push(...enforceReferencesPresence(linkingContext));

  accumulatedErrors.push(
    ...forEachWithErrors(
      [...parsedFile.parsedDocument.operations.values()],
      descriptor => {
        linkOperationTypes(descriptor, result, linkingContext);
      },
    ),
  );

  if (accumulatedErrors.length > 0) {
    throw new LinkingError(accumulatedErrors);
  }

  addRootFileImports(result, linkingContext);

  return result;
}

export function linkSourcesFile(
  filePath: string,
  fileGraph: ParsedFileGraph,
): SourcesFileContents {
  const parsedFile = fileGraph.get(filePath);
  if (!parsedFile) {
    throw new FileNotFoundInGraph(filePath);
  }

  const result: SourcesFileContents = {
    kind: 'SourcesFile',
    fileImports: new Map(),
    vendorImports: new Map(),
    batchFnDeclarations: [],
  };

  const linkingContext: LinkingContext = {
    filePath,
    fileGraph,
    kind: OriginKind.Object,
    linkingType: LinkingType.SourcesFile,
    parsedFile,
    referenceMap: new Map(),
  };

  // Generate declarations for all object types with at least one ID! field.
  [...parsedFile.parsedDocument.objects.values()].forEach(objectDescriptor => {
    // Immediately exclude if it's a root type
    if (isRootType(objectDescriptor.name, linkingContext)) {
      return;
    }

    const idFields = objectDescriptor.fields.filter(
      fieldDescriptor =>
        fieldDescriptor.kind === 'SingleFieldDescriptor' &&
        fieldDescriptor.type.kind === 'KnownScalarType' &&
        fieldDescriptor.type.type === KnownScalarTypes.ID,
    );

    if (idFields.length > 0) {
      result.batchFnDeclarations.push({
        objectDescriptor,
        idFields,
      });
    }
  });

  // Enforce that the file must have at least one import.
  if (result.batchFnDeclarations.length === 0) {
    throw new LinkingError([[0, new EmptyLoadersFileError(filePath)]]);
  }

  addSourcesFileImports(result, linkingContext);

  return result;
}

export function linkResolversFile(
  filePath: string,
  fileGraph: ParsedFileGraph,
): ResolversFileContents {
  const parsedFile = fileGraph.get(filePath);
  if (!parsedFile) {
    throw new FileNotFoundInGraph(filePath);
  }

  const result: ResolversFileContents = {
    kind: 'ResolversFile',
    fileImports: new Map(),
    vendorImports: new Map(),
    typeDeclarations: [],
  };

  const linkingContext: LinkingContext = {
    filePath,
    fileGraph,
    kind: OriginKind.Object,
    linkingType: LinkingType.ResolversFile,
    parsedFile,
    referenceMap: new Map(),
  };

  // Immediately exclude if it's a root type
  [...parsedFile.parsedDocument.objects.values()].forEach(objectDescriptor => {
    // Immediately exclude if it's a root type
    if (isRootType(objectDescriptor.name, linkingContext)) {
      return;
    }

    result.typeDeclarations.push(objectDescriptor);
  });

  addResolversFileImports(result, linkingContext);

  return result;
}
