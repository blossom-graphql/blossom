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
  ObjectExtensionDescriptor,
  ObjectTypeAnnotation,
} from './parsing';
import { blossomInstancePath, typesFilePath, resolversFilePath } from './paths';
import {
  FileNotFoundInGraph,
  InvalidReferenceError,
  ReferenceNotFoundError,
  LinkingError,
  DuplicateFieldError,
  EmptyLoadersFileError,
  NoFieldsTypeError,
  NoMembersError,
} from './errors';
import { forEachWithErrors, /* fullInspect, */ ErrorsOutput } from './utils';
import {
  rootResolverSignatureName,
  resolverName,
  referencedTypeName,
} from './naming';

export const GRAPHQL_PACKAGE_NAME = 'graphql';
export const CORE_PACKAGE_NAME = '@blossom-gql/core';
export const INSTANCE_RESOLVE_NAME = 'resolve';
export const INSTANCE_RESOLVE_ARRAY_NAME = 'resolveArray';
export const INSTANCE_CONTEXT_NAME = 'RequestContext';
export const CORE_BATCHFN_NAME = 'BatchFunction';
export const CORE_RESOLVER_NAME = 'Resolver';
export const INSTANCE_ROOT_QUERY_NAME = 'BlossomRootQuery';
export const INSTANCE_ROOT_MUTATION_NAME = 'BlossomRootMutation';
export const MAYBE_NAME = 'Maybe';
export const CORE_DELIVER_NAME = 'deliver';

export const QUERY_SIGNATURE_NAME = 'QueryResolverSignature';
export const MUTATION_SIGNATURE_NAME = 'MutationResolverSignature';
export const OBJECT_SIGNATURE_NAME = 'ObjectResolverSignature';
export const CONNECTION_NAME = 'Connection';

const OPERATION_MAP: { [key in SupportedOperation]: string } = {
  // Using [SupportOperation.Query] throws runtime error.
  query: blossomGraphqlQueryTypeName(),
  mutation: blossomGraphqlMutationTypeName(),
};

// TODO: Move me.
export function blossomGraphqlQueryTypeName(): string {
  return 'Query';
}

export function blossomGraphqlMutationTypeName(): string {
  return 'Mutation';
}

export enum DependencyFlag {
  HasOptionalReference = 'HasOptionalReference',
  HasThunkedField = 'HasThunkedField',
  HasQuerySignatures = 'HasQuerySignatures',
  HasMutationSignatures = 'HasMutationSignatures',
  HasReferencedTypeOperation = 'HasReferencedTypeOperation',
  HasReferencedArrayTypeOperation = 'HasReferencedArrayTypeOperation',
  HasRootQuery = 'HasRootQuery',
  HasRootMutation = 'HasRootMutation',
  HasConnection = 'HasConnection',
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
  ObjectExtension = 'ObjectExtension',
  InputExtension = 'InputExtension',
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

export type FieldOriginKind =
  | OriginKind.Object
  | OriginKind.Input
  | OriginKind.ObjectExtension
  | OriginKind.InputExtension;

export type FieldOriginDescription = {
  fieldName: string;
  objectName: string;
  originKind: FieldOriginKind;
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
        fieldOriginDescription.originKind === OriginKind.Object ||
        fieldOriginDescription.originKind === OriginKind.ObjectExtension
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
  parent: ObjectTypeDescriptor | ObjectExtensionDescriptor,
) {
  let originKind: FieldOriginKind;
  switch (parent.objectType) {
    case ObjectTypeKind.Object:
      originKind =
        parent.kind === 'ObjectExtensionsDescriptor'
          ? OriginKind.ObjectExtension
          : OriginKind.Object;
      break;
    case ObjectTypeKind.Input:
      originKind =
        parent.kind === 'ObjectExtensionsDescriptor'
          ? OriginKind.InputExtension
          : OriginKind.Input;
      break;
    default:
      originKind = OriginKind.Object;
  }

  // TODO: Under certain circumstances, extensions will require the base type
  // as a reference as well. Be ready to bring support to these.

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
  descriptor:
    | ObjectTypeDescriptor
    | ObjectExtensionDescriptor
    | UnionTypeDescriptor
    | OperationDescriptor,
): void {
  if (descriptor.kind === 'UnionTypeDescriptor') {
    descriptor.members.forEach(field =>
      addReferenceInGraph(linkingContext.referenceMap, field, {
        originKind: OriginKind.Union,
        name: descriptor.name,
      }),
    );
  } else if (
    descriptor.kind === 'ObjectTypeDescriptor' ||
    descriptor.kind === 'ObjectExtensionsDescriptor'
  ) {
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
  linkingContext: LinkingContext,
): boolean {
  switch (reference.originKind) {
    case OriginKind.Object:
    case OriginKind.ObjectExtension:
      return [ElementKind.Type, ElementKind.Enum, ElementKind.Union].includes(
        resolution.elementKind,
      );
    case OriginKind.ObjectArgument:
      const typeRepresentsRoot = isRootType(
        reference.fieldOriginDescription.objectName,
        linkingContext,
      );

      if (typeRepresentsRoot) {
        return [
          ElementKind.Input,
          ElementKind.Enum,
          ElementKind.Union,
        ].includes(resolution.elementKind);
      } else {
        return [ElementKind.Type, ElementKind.Enum, ElementKind.Union].includes(
          resolution.elementKind,
        );
      }
    case OriginKind.InputExtension:
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
              linkingContext,
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

export function extractResolution(
  fieldName: string,
  linkingContext: LinkingContext,
): ResolutionDescription | undefined {
  const { referenceMap } = linkingContext;

  const referenceDescriptor = referenceMap.get(fieldName);
  if (!referenceDescriptor) {
    // Descriptor must exist.
    throw new Error('Name not found.'); // TODO: Internal.
  }

  return referenceDescriptor.resolution;
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
  const resolution = extractResolution(fieldName, linkingContext);
  if (!resolution) {
    // Must be resolved.
    throw new Error(`Field ${fieldName} not resolved.`); // TODO: Internal.
  }
  if (resolution.elementKind !== elementKind) {
    // Must be Object type.
    throw new Error(
      `${fieldName} of kind ${resolution.elementKind} doesn't match Element Kind ${elementKind}.`,
    ); // TODO: Internal.
  }

  // Extract definition from the file given by the path
  const { fileGraph } = linkingContext;
  const parsedFile = fileGraph.get(resolution.filePath);
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
  descriptor: ObjectExtensionDescriptor,
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  let operation: SupportedOperation | undefined = undefined;
  Object.entries(OPERATION_MAP).some(
    ([supportedOperation, typeName]: [string, string]) => {
      const isSupportedOperation = descriptor.name === typeName;
      if (isSupportedOperation)
        operation = supportedOperation as SupportedOperation;

      return isSupportedOperation;
    },
  );

  if (!operation) return;

  // 1. Create descriptor for each one of the fields.
  descriptor.fields.forEach(field => {
    const fieldDescriptor: FieldDescriptor = {
      ...field,
      thunkType: ThunkType.AsyncFunction,
    };
    addFieldCommonDependencyFlags(fieldDescriptor, result);

    const operationFieldDescriptor: OperationFieldDescriptor = {
      kind: 'OperationFieldDescriptor',
      fieldDescriptor,
      operation: operation as SupportedOperation,
      objectType: {
        kind: 'ReferencedType',
        name: descriptor.name,
      },
    };

    result.operationDeclarations.push(operationFieldDescriptor);

    if (outputBaseType(fieldDescriptor).kind === 'ReferencedType') {
      if (fieldDescriptor.kind === 'ArrayFieldDescriptor') {
        result.dependencyFlags.set(
          DependencyFlag.HasReferencedArrayTypeOperation,
          true,
        );
      } else {
        result.dependencyFlags.set(
          DependencyFlag.HasReferencedTypeOperation,
          true,
        );
      }
    }
  });

  if (operation === SupportedOperation.Query) {
    result.dependencyFlags.set(DependencyFlag.HasRootQuery, true);
  } else if (operation === SupportedOperation.Mutation) {
    result.dependencyFlags.set(DependencyFlag.HasRootMutation, true);
  }

  // 2. Add dependency flags for properly resolving imports when we are
  //    generating a types file.
  if (linkingContext.linkingType !== LinkingType.TypesFile) return;

  if (operation === SupportedOperation.Query) {
    result.dependencyFlags.set(DependencyFlag.HasQuerySignatures, true);
  } else if (operation === SupportedOperation.Mutation) {
    result.dependencyFlags.set(DependencyFlag.HasMutationSignatures, true);
  }
}

export function linkUnionTypes(
  unionDescriptor: UnionTypeDescriptor,
  result: TypesFileContents,
  _linkingContext: LinkingContext,
) {
  if (unionDescriptor.members.length === 0) {
    throw new NoMembersError(unionDescriptor);
  }

  result.unionDeclarations.push(unionDescriptor);
}

export function linkEnumTypes(
  enumDescriptor: EnumTypeDescriptor,
  result: TypesFileContents,
  _linkingContext: LinkingContext,
) {
  result.enumDeclarations.push(enumDescriptor);
}

export function isRootType(
  fieldName: string,
  linkingContext: LinkingContext,
  expectedOperation?: SupportedOperation,
): boolean {
  if (expectedOperation && fieldName !== OPERATION_MAP[expectedOperation])
    return false;

  return Object.values(OPERATION_MAP).some(hasRootType);

  function hasRootType(typeName: string) {
    return (
      fieldName === typeName &&
      !!linkingContext.parsedFile.parsedDocument.objectExtensions.get(typeName)
    );
  }
}

export function linkObjectTypes(
  typeDescriptor: ObjectTypeDescriptor,
  result: TypesFileContents | RootFileContents,
  linkingContext: LinkingContext,
) {
  // TODO: When extensions are available, this must also consider extensions
  // as a by updating fields and whatever's new.
  if (!typeDescriptor.virtual && typeDescriptor.fields.length === 0) {
    throw new NoFieldsTypeError(typeDescriptor);
  }

  if (typeDescriptor.annotations.has(ObjectTypeAnnotation.HasConnection)) {
    result.dependencyFlags.set(DependencyFlag.HasConnection, true);
  }

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
  _linkingContext: LinkingContext,
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
    addImport(
      result.fileImports,
      'FileImport',
      blossomInstancePath(),
      INSTANCE_CONTEXT_NAME,
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

  if (result.dependencyFlags.get(DependencyFlag.HasThunkedField)) {
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

  // 3. Add connections, if required
  if (result.dependencyFlags.has(DependencyFlag.HasConnection)) {
    addImport(
      result.vendorImports,
      'VendorImport',
      CORE_PACKAGE_NAME,
      CONNECTION_NAME,
    );
  }
}

export function addRootFileImports(
  result: RootFileContents,
  linkingContext: LinkingContext,
) {
  // 1. Add common vendor imports.
  // ! No longer required. They are absorbed by the signatures.
  // ! To be removed.
  // addCommonVendorImports(result, linkingContext);

  // 2. Add resolve import when necessary
  if (result.dependencyFlags.get(DependencyFlag.HasReferencedTypeOperation))
    addImport(
      result.fileImports,
      'FileImport',
      blossomInstancePath(),
      INSTANCE_RESOLVE_NAME,
    );

  if (
    result.dependencyFlags.get(DependencyFlag.HasReferencedArrayTypeOperation)
  )
    addImport(
      result.fileImports,
      'FileImport',
      blossomInstancePath(),
      INSTANCE_RESOLVE_ARRAY_NAME,
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
  // ! No longer required since signatures include them.
  // ! To be removed once we are sure about this.
  // addTypeReferencesImports(result, linkingContext);

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
  addImport(
    result.vendorImports,
    'VendorImport',
    CORE_PACKAGE_NAME,
    CORE_BATCHFN_NAME,
  );

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
    CORE_DELIVER_NAME,
  );

  addImport(
    result.fileImports,
    'FileImport',
    blossomInstancePath(),
    INSTANCE_CONTEXT_NAME,
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

  addImport(
    result.fileImports,
    'FileImport',
    blossomInstancePath(),
    INSTANCE_CONTEXT_NAME,
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
    linkEnumTypes(descriptor, result, linkingContext);
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
    Object.values(OPERATION_MAP),
    typeName => {
      const descriptor = linkingContext.parsedFile.parsedDocument.objectExtensions.get(
        typeName,
      );
      if (!descriptor) return;

      updateReferenceMap(linkingContext, descriptor);

      linkOperationTypes(descriptor, result, linkingContext);
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

  const operationErrors = forEachWithErrors(
    Object.values(OPERATION_MAP),
    typeName => {
      const descriptor = linkingContext.parsedFile.parsedDocument.objectExtensions.get(
        typeName,
      );
      if (!descriptor) return;

      updateReferenceMap(linkingContext, descriptor);

      linkOperationTypes(descriptor, result, linkingContext);
    },
  );

  accumulatedErrors.push(...operationErrors);

  resolveReferences(linkingContext);
  accumulatedErrors.push(...enforceReferencesPresence(linkingContext));

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
