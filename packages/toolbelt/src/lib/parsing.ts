/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import {
  ObjectTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  SchemaDefinitionNode,
  EnumTypeDefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  TypeNode,
  InputValueDefinitionNode,
  NamedTypeNode,
  parse,
  UnionTypeDefinitionNode,
  ObjectTypeExtensionNode,
  InputObjectTypeExtensionNode,
} from 'graphql';

import { ImportParsingError, UnsupportedOperationError } from './errors';
import { appPath, APP_DIR } from './paths';

export const BLOSSOM_IMPLEMENTATION_DIRECTIVE = 'blossomImpl';
export const BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME = 'type';

const PATH_REGEX = `[^'"]+`;
const IMPORT_MATCH_REGEX = `^#\\s?import\\s+(?<imported>.+\\s+from\\s+)?(?<quote>['"])(?<path>${PATH_REGEX})(\\k<quote>);?$`;

export enum SupportedOperation {
  Query = 'query',
  Mutation = 'mutation',
}

/**
 * Descriptor of a document node.
 */
type DocumentNodeDescriptor<T> = {
  /**
   * Full descriptor.
   */
  node: T;
};

/**
 * Mapping that contains the name of a type / input and it's descriptor,
 * including the node and the file where it was defined.
 */
type DocumentNameMap<T> = { [key: string]: DocumentNodeDescriptor<T> };

/**
 * An intermediate dictionary where all the types described in the file are
 * consolidated into maps. This in turn is useful for checking whether
 * internal types are defined inside the schema.
 */
export type IntermediateDictionary = {
  /**
   * Map of parsed objects (GraphQL types).
   */
  objects: DocumentNameMap<ObjectTypeDefinitionNode>;
  /**
   * Map of parsed inputs.
   */
  inputs: DocumentNameMap<InputObjectTypeDefinitionNode>;
  /**
   * Map of parsed enums.
   */
  enums: DocumentNameMap<EnumTypeDefinitionNode>;
  /**
   * Map of parsed unions.
   */
  unions: DocumentNameMap<UnionTypeDefinitionNode>;
  /**
   * Map of parsed object extensions.
   */
  objectExtensions: DocumentNameMap<ObjectTypeExtensionNode>;
  /**
   * Map of parsed input extensions.
   */
  inputExtensions: DocumentNameMap<InputObjectTypeExtensionNode>;
  /**
   * The node that is defining the schema on this file.
   */
  schema?: SchemaDefinitionNode;
};

/**
 * Associates a full pathname to the intermediate dictionary resulting of its
 * parsing.
 */
export type DocumentParsingOuput = {
  objects: Map<string, ObjectTypeDescriptor>;
  inputs: Map<string, ObjectTypeDescriptor>;
  enums: Map<string, EnumTypeDescriptor>;
  unions: Map<string, UnionTypeDescriptor>;
  operations: Map<SupportedOperation, OperationDescriptor>;
  objectExtensions: Map<string, ObjectExtensionDescriptor>;
  inputExtensions: Map<string, ObjectExtensionDescriptor>;
};

/**
 * Any of the possible thunking types a field can have. On schemas this is
 * expected to be defined by the @blossomImpl directive.
 */
export enum ThunkType {
  /**
   * Is an async function, i.e. a function that returns Promise<T> when
   * invoked.
   */
  AsyncFunction = 'AsyncFunction',
  /**
   * Is a function.
   */
  Function = 'Function',
  /**
   * No thunking, the result is expected to be directly returned.
   */
  None = 'None',
}

export type FieldDescriptorBase = {
  name: string;
  comments?: string;
  /**
   * Is it required to always return the array? Even though it's empty?
   */
  required: boolean;
  thunkType: ThunkType;
  arguments?: FieldDescriptor[];
};

/**
 * Full descriptor of a single type entry.
 */
type SingleFieldDescriptor = FieldDescriptorBase & {
  kind: 'SingleFieldDescriptor';
  type: TypeDescriptor;
};

/**
 * Full descriptor of an array field.
 */
type ArrayFieldDescriptor = FieldDescriptorBase & {
  kind: 'ArrayFieldDescriptor';
  /**
   * Descriptor of a single element of the array.
   */
  elementDescriptor: FieldDescriptor;
};

/**
 * The full description of a field on a type or input declaration. This can be
 * either a single field declaration or an array declaration. This is
 * determined by the `array` property.
 */
export type FieldDescriptor = SingleFieldDescriptor | ArrayFieldDescriptor;

type OperationBaseDescriptor = {
  operation: SupportedOperation;
  objectType: ReferencedTypeDescriptor;
};

export type OperationDescriptor = OperationBaseDescriptor & {
  kind: 'OperationDescriptor';
};

export type OperationFieldDescriptor = OperationBaseDescriptor & {
  kind: 'OperationFieldDescriptor';
  fieldDescriptor: FieldDescriptor;
};

export type EnumValueDescriptor = {
  originalName: string;
  comments?: string;
};

export type EnumTypeDescriptor = {
  kind: 'EnumTypeDescriptor';
  name: string;
  comments?: string;
  fields: EnumValueDescriptor[];
};

export type UnionTypeDescriptor = {
  kind: 'UnionTypeDescriptor';
  name: string;
  comments?: string;
  members: string[];
  referencedTypes: ReferencedTypeList;
};

/**
 * Enum containing all the known scalar types. Used internally in `switch`
 * statements used in codegen.
 */
export enum KnownScalarTypes {
  ID = 'ID',
  String = 'String',
  Boolean = 'Boolean',
  Number = 'Number',
}

export enum ThunkImplementationType {
  AsyncFunction = 'async',
  Function = 'function',
  None = 'none',
}

/**
 * Descriptor for a known scalar type.
 */
export type KnownScalarTypeDescriptor = {
  kind: 'KnownScalarType';
  type: KnownScalarTypes;
};

/**
 * Descriptor for a referenced type descriptor.
 */
export type ReferencedTypeDescriptor = {
  kind: 'ReferencedType';
  name: string;
};

export type TypeDescriptor =
  | KnownScalarTypeDescriptor
  | ReferencedTypeDescriptor;

export type ObjectDescriptorBase = {
  objectType: ObjectTypeKind;
  name: string;
  fields: FieldDescriptor[];
  referencedTypes: ReferencedTypeList;
};

/**
 * Full description of an object type. Any `type` and `input` declaration in
 * GraphQL objects is collapsed into this data structure which in turned is
 * then consumed for codegen purposes.
 */
export type ObjectTypeDescriptor = ObjectDescriptorBase & {
  kind: 'ObjectTypeDescriptor';
  comments?: string;
};

export type ObjectExtensionDescriptor = ObjectDescriptorBase & {
  kind: 'ObjectExtensionsDescriptor';
};

/**
 * Any of the possible object types.
 */
export enum ObjectTypeKind {
  /**
   * Object. Used for `type` declarations in GraphQL Schemas.
   */
  Object = 'Object',
  /**
   * Input. Used for `input` declarations in GraphQL Schemas.
   */
  Input = 'Input',
}

/**
 * Maps a full path to a wildcard to indicate that everything should be imported
 * or only a list of types.
 */
export type ImportResolutionMap = {
  full: Set<string>;
  named: Map<string, Set<string>>;
};

/**
 * Structure to represent the parsing result of a schema and its dependencies.
 */
type ParsedSchemaReferences = {
  /**
   * Full string for the schema.
   */
  schema: string;
  /**
   * Map containing the full path of the imported files and a list of the
   * required dependencies.
   */
  references: ImportResolutionMap;
};

/**
 * Map from a full path to the ParsedSchema reference structure.
 */
type PathSchemaMap = Map<string, ParsedSchemaReferences>;

export type ParsedFileDescriptor = ParsedSchemaReferences & {
  parsedDocument: DocumentParsingOuput;
};

export type ParsedFileGraph = Map<string, ParsedFileDescriptor>;

export type ReferencedTypeList = Set<string>;

export async function parseFileGraph(
  filePath: string,
): Promise<ParsedFileGraph> {
  // TODO: Display errors.
  const parsingMap = await getParsingMap(filePath);
  const result: ParsedFileGraph = new Map();

  // For each of the files, parse the documents
  for (const [path, parsedSchema] of parsingMap) {
    const document = parse(parsedSchema.schema);

    // TODO: Collapse and display parsing errors on parseDocumentNode.
    result.set(path, {
      ...parsedSchema,
      parsedDocument: parseDocumentNode(document),
    });
  }

  return result;
}

export function getImportStatementNames(_: string): '*' | Set<string> {
  // TODO: Provide the Set case to allow importing specific paths.
  // At the moment it's wired to '*'
  return '*';
}

/**
 * Given a schema string, reads all the import statements and returns a map
 * with all the absolute paths of the imports and the types that must be
 * imported from the referenced file.
 *
 * @param schema String of the schema to be parsed.
 *
 * @param basePath Base path to resolve the relative paths.
 */
export function getSchemaImports(
  schema: string,
  basePath: string = APP_DIR,
): ImportResolutionMap {
  const lines = schema.split('\n');
  const accumulatedImports: ImportResolutionMap = {
    full: new Set(),
    named: new Map(),
  };

  lines.forEach(line => {
    // Start with a RegExp object from scratch to avoid collisions
    const regex = new RegExp(IMPORT_MATCH_REGEX);
    const result = regex.exec(line);

    // Skip this line if the necessary information is not implemented
    if (!result || !result.groups || !result.groups.path) return;

    const realPath = appPath(result.groups.path, basePath);
    const fullValue = accumulatedImports.full.has(realPath);
    const namedValue = accumulatedImports.named.get(realPath);

    const parsedValue = getImportStatementNames(line);

    /**
     * This behavior can be easily understood with a truth table:
     *
     * p: parsedValue is wildcard = T if pV == '*' | false
     * f: fullValue is present    = T/F
     * n: namedValue is present   = T/F
     *
     * p\fn:  F F       F T         T T         T F
     *  T     set full  do nothing  do nothing  do nothing
     *  F     set named do nothing  do nothing  do nothing
     */
    if (!fullValue && parsedValue === '*') {
      // i.e. set full
      accumulatedImports.full.add(realPath);

      // remove references from named imports as well
      accumulatedImports.named.delete(realPath);
    } else if (!fullValue && parsedValue !== '*') {
      // i.e. set named
      if (!namedValue) {
        accumulatedImports.named.set(realPath, new Set([...parsedValue]));
      } else {
        accumulatedImports.named.set(
          realPath,
          new Set([...namedValue, ...parsedValue]),
        );
      }
    }
  });

  return accumulatedImports;
}

/**
 * Given a full GraphQL file path, reads the file to retrieve the schema and
 * recursively parses the imports from other files. The result is map from the
 * full path file to a structure that contains the schema contents and the
 * parsed references.
 *
 * @param filePath Full resolved path of the file to be read.
 *
 * @param accumulated Accumulated map of the already parsed results. If null,
 * a new one will be created.
 */
export async function getParsingMap(
  filePath: string,
  accumulated?: PathSchemaMap,
) {
  // Base case: Return accumulator if path is in accumulator
  if (accumulated && accumulated.has(filePath)) return accumulated;

  // Read file + Create new accumulator with path
  const accumulator: PathSchemaMap = accumulated
    ? new Map(accumulated)
    : new Map();
  let fileContents: Buffer;

  try {
    fileContents = await fs.promises.readFile(filePath);
  } catch (error) {
    throw new ImportParsingError(filePath, error);
  }

  const schema = fileContents.toString('utf-8');
  const parsedPath = path.parse(filePath);

  // Call getSchemaImports() with the retrieved schema.
  const imports = getSchemaImports(schema, parsedPath.dir);

  // Update the accumulator with the new result
  accumulator.set(filePath, {
    schema,
    references: imports,
  });

  // Get a binding of the accumulator
  let accumulatorRef = accumulator;

  // For each of the imports call getParsingMap with path and accumulator.
  // If accumulator is different, merge with results.
  for (const importPath of [...imports.full, ...imports.named.keys()]) {
    const newAccumulator = await getParsingMap(importPath, accumulatorRef);

    // If there's a new reference, then we update the pointer
    if (newAccumulator !== accumulatorRef) accumulatorRef = newAccumulator;
  }

  return accumulatorRef;
}

/**
 * Receives a GraphQL.js document node and returns a data structure containing
 * all the parsed types and root values.
 *
 * @param document DocumentNode coming from the parsed GraphQL schema.
 */
export function parseDocumentNode(
  document: DocumentNode,
): DocumentParsingOuput {
  const intermediateDict: IntermediateDictionary = {
    objects: {},
    inputs: {},
    enums: {},
    unions: {},
    objectExtensions: {},
    inputExtensions: {},
    schema: undefined,
  };

  let schemaDefinition: SchemaDefinitionNode | undefined;

  // Collapse parseable definitions into the IntermediateDictionary.
  document.definitions.forEach(definition => {
    switch (definition.kind) {
      case 'ObjectTypeDefinition':
        intermediateDict.objects[definition.name.value] = {
          node: definition,
        };
        break;
      case 'InputObjectTypeDefinition':
        intermediateDict.inputs[definition.name.value] = {
          node: definition,
        };
        break;
      case 'SchemaDefinition':
        schemaDefinition = definition;
        break;
      case 'EnumTypeDefinition':
        intermediateDict.enums[definition.name.value] = {
          node: definition,
        };
        break;
      case 'UnionTypeDefinition':
        intermediateDict.unions[definition.name.value] = { node: definition };
        break;
      case 'ObjectTypeExtension':
        intermediateDict.objectExtensions[definition.name.value] = {
          node: definition,
        };
        break;
      case 'InputObjectTypeExtension':
        intermediateDict.inputExtensions[definition.name.value] = {
          node: definition,
        };
        break;
      // TODO: Extra types go here in the future.
      default:
        // Do nothing
        // TODO: Logger.
        break;
    }
  });

  // TODO: Resolve other schemas WITHOUT considering the schema {} statement.

  // If there's a schema definition in the IntermediateDictionary, check that
  // the types are properly defined in the objects map.
  //
  // We always parse it because it's required in nodeReducer.
  const operations: Map<SupportedOperation, OperationDescriptor> = new Map();

  if (schemaDefinition) {
    schemaDefinition.operationTypes.forEach(operation => {
      switch (operation.operation) {
        case 'query':
          operations.set(SupportedOperation.Query, {
            kind: 'OperationDescriptor',
            operation: SupportedOperation.Query,
            objectType: {
              kind: 'ReferencedType',
              name: operation.type.name.value,
            },
          });
          break;
        case 'mutation':
          operations.set(SupportedOperation.Mutation, {
            kind: 'OperationDescriptor',
            operation: SupportedOperation.Mutation,
            objectType: {
              kind: 'ReferencedType',
              name: operation.type.name.value,
            },
          });
          break;
        default:
          throw new UnsupportedOperationError(operation.operation);
      }
    });
  }

  // Return the parsed AST for the objects.
  // TODO: Do something with aliases.
  return {
    objects: reduceToMap(
      Object.values(intermediateDict.objects),
      parseDocumentObjectType,
    ),
    inputs: reduceToMap(
      Object.values(intermediateDict.inputs),
      parseDocumentObjectType,
    ),
    enums: reduceToMap(
      Object.values(intermediateDict.enums),
      parseDocumentEnumType,
    ),
    unions: reduceToMap(
      Object.values(intermediateDict.unions),
      parseDocumentUnionType,
    ),
    operations,
    objectExtensions: reduceToMap<
      ObjectTypeExtensionNode,
      ObjectExtensionDescriptor
    >(
      Object.values(intermediateDict.objectExtensions),
      parseDocumentObjectType,
    ),
    inputExtensions: reduceToMap<
      InputObjectTypeExtensionNode,
      ObjectExtensionDescriptor
    >(Object.values(intermediateDict.inputExtensions), parseDocumentObjectType),
  };
}

export function reduceToMap<U, V extends { name: string }>(
  values: { node: U }[],
  parser: (descriptor: U) => V | null,
): Map<string, V> {
  return values.reduce((accumulator: Map<string, V>, current: { node: U }) => {
    const parsedResult = parser(current.node);
    if (parsedResult !== null) accumulator.set(parsedResult.name, parsedResult);

    return accumulator;
  }, new Map<string, V>());
}

/**
 * Given a list of directives, coming from a parsed field, indicates the
 * thunkType of the field.
 *
 * TODO: This is not a clean approach. A dictionary of directives should be
 * created and then attach handlers to them in a global file.
 *
 * @param directives List of directives.
 */
export function thunkTypeFromDirectives(field: FieldDefinitionNode) {
  const { arguments: args, directives } = field;
  // If this field has arguments, then it must default to a function
  // type. In any other cases it is safe to pass it. Thus, the default thunk
  // value comes from the fact whether the field has arguments.
  const hasArguments = args && args.length > 0;
  const defaultThunkValue = hasArguments ? ThunkType.Function : ThunkType.None;

  if (!directives || directives.length === 0) return defaultThunkValue;

  // Find whether the blossomImpl directive is present in the list of
  // directives.
  const blossomImplDirective = directives.find(
    ({ name: { value } }) => value === BLOSSOM_IMPLEMENTATION_DIRECTIVE,
  );
  if (!blossomImplDirective) {
    return defaultThunkValue;
  }

  // From the directive, find the argument with name `type`.
  const typeArgument =
    blossomImplDirective.arguments &&
    blossomImplDirective.arguments.find(
      argument => argument.name.value === BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME,
    );
  if (!typeArgument) {
    return defaultThunkValue;
  }

  if (
    typeArgument.value.kind === 'EnumValue' ||
    typeArgument.value.kind === 'StringValue'
  ) {
    switch (typeArgument.value.value) {
      case ThunkImplementationType.Function:
        return ThunkType.Function;
      case ThunkImplementationType.AsyncFunction:
        return ThunkType.AsyncFunction;
      default:
      // Unable to parse. Send default value.
      // TODO: Log a warning.
      case ThunkImplementationType.None:
        return defaultThunkValue;
    }
  } else {
    return defaultThunkValue;
  }
}

/**
 * Receives a NamedType (GraphQL) structure and maps it to a KnownTypeDescriptor
 * or a ReferencedTypeDescriptor depending on whether the is a known type or
 * is available on a definition.
 *
 * If it's not a known type and the definition is not available on the
 * intermediate dictionary, then a TypeNotFound exception will be thrown.
 *
 * @param type Definition of the type.
 *
 * @param referencedTypes Set of the referenced names for the parsing of this
 * field.
 */
export function parseFieldType(
  type: NamedTypeNode,
  referencedTypes: ReferencedTypeList,
): KnownScalarTypeDescriptor | ReferencedTypeDescriptor {
  const name = type.name.value;

  switch (name) {
    case 'ID':
      return { kind: 'KnownScalarType', type: KnownScalarTypes.ID };
    case 'String':
      return { kind: 'KnownScalarType', type: KnownScalarTypes.String };
    case 'Int':
    case 'Float':
      return { kind: 'KnownScalarType', type: KnownScalarTypes.Number };
    case 'Boolean':
      return { kind: 'KnownScalarType', type: KnownScalarTypes.Boolean };
    default:
      referencedTypes.add(type.name.value);
      return { kind: 'ReferencedType', name: type.name.value };
  }
}

/**
 * Given a FieldDefinitionNode, InputValueDefinitionNode or TypeNode, all of
 * which can come from the parsing of fields in GraphQL.js, maps the results
 * to the correct FieldDescriptor structure, internal to the usage of Blossom
 * in codegen efforts.
 *
 * @param definition DefinitionNode from the GraphQL structure.
 *
 * @param kind Indicates whether this field comes from an object or an input.
 * The moment the descriptor is expanded into the TypeNode, we loose track of
 * this and we're expecting this function to be recursive.
 *
 * @param intermediateDict Intermediate dictionary with all the definitions
 * collapsed in a Map. Necessary when indicating the source of the type and
 * required when trying to throw because of not-found types in this file.
 */
export function parseFieldDefinitionNode(
  definition: FieldDefinitionNode | InputValueDefinitionNode | TypeNode,
  kind: ObjectTypeKind,
  referencedTypes: ReferencedTypeList,
): FieldDescriptor {
  if (definition.kind === 'ListType') {
    // A list. We must enforce that array is true in this case and then recurse
    // to set the behavior of the element.
    const result = parseFieldDefinitionNode(
      definition.type,
      kind,
      referencedTypes,
    ) as FieldDescriptor;

    return {
      kind: 'ArrayFieldDescriptor',
      name: '',
      required: false,
      elementDescriptor: result,
      thunkType: ThunkType.None,
    };
  } else if (definition.kind === 'NonNullType') {
    // Non null type. Result will be defined by recursing into definition.type.
    // However, required must be forced to be true.

    const result = parseFieldDefinitionNode(
      definition.type,
      kind,
      referencedTypes,
    ) as FieldDescriptor;

    return {
      ...result,
      required: true,
    };
  } else if (definition.kind === 'NamedType') {
    // Named type is the base result value. From here we just need to retrieve
    // the type in order to match it with any of the references.

    return {
      kind: 'SingleFieldDescriptor',
      name: definition.name.value,
      type: parseFieldType(definition, referencedTypes),
      thunkType: ThunkType.None,
      required: false,
    };
  } else {
    // One of the base types incoming. We set the common elements and recurse
    // by calling this same function with definition.type.

    // Parse arguments. We only consider them when the definition is a
    // FieldDefinition. We initialize this as
    let args: FieldDescriptor[];

    if (
      definition.kind === 'FieldDefinition' &&
      definition.arguments &&
      definition.arguments.length > 0
    ) {
      args = definition.arguments.map(argument =>
        parseFieldDefinitionNode(
          argument,
          ObjectTypeKind.Input,
          referencedTypes,
        ),
      );
    } else {
      args = [];
    }

    // These are the starting point and the defaults if nothing else is set.
    const baseResult = {
      array: false,
      required: false,
      elementDescriptor: undefined,
    };

    // These are always set and should not change.
    const staticResults = {
      name: definition.name.value,
      comments: definition.description && definition.description.value,
      // Only parse thunk type for definitions that are objects and have
      // directives. We don't parse them for inputs. Moreover, we even should
      // throw an error in the future.
      thunkType:
        definition.kind === 'FieldDefinition'
          ? thunkTypeFromDirectives(definition)
          : ThunkType.None,
      arguments: args,
    };

    const result = parseFieldDefinitionNode(
      definition.type,
      kind,
      referencedTypes,
    ) as FieldDescriptor;

    return {
      ...baseResult,
      ...result,
      ...staticResults,
    };
  }
}

/**
 * Receives an ObjectTypeDefinition node or an InputObjectTypeDefinition node
 * and return the ObjectTypeDescription, which is our intermediate data
 * structure for codegen purposes.
 *
 * @param nodeDescriptor Definition structure of the object / input object type.
 */
export function parseDocumentObjectType(
  nodeDescriptor: ObjectTypeExtensionNode | InputObjectTypeExtensionNode,
): ObjectExtensionDescriptor;
export function parseDocumentObjectType(
  nodeDescriptor: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode,
): ObjectTypeDescriptor;
export function parseDocumentObjectType(
  nodeDescriptor:
    | ObjectTypeDefinitionNode
    | InputObjectTypeDefinitionNode
    | ObjectTypeExtensionNode
    | InputObjectTypeExtensionNode,
): ObjectTypeDescriptor | ObjectExtensionDescriptor {
  const referencedTypes: ReferencedTypeList = new Set();

  /**
   * Receives a FieldDefinitionNode or a InputValueDefinitionNode an maps it
   * to a FieldDescriptor, the intermediate Blossom structure used for analysis
   * and code generation.
   *
   * This method lives inside the closure in order to gain access to `type`
   * and `intermediateDict` elements from the parent function.
   *
   * @param field GraphQL descriptor for the field, which can be either an
   * object field or an input field.
   */
  function parserIteratee(
    field: FieldDefinitionNode | InputValueDefinitionNode,
  ): FieldDescriptor {
    if (
      nodeDescriptor.kind === 'ObjectTypeDefinition' ||
      nodeDescriptor.kind === 'ObjectTypeExtension'
    ) {
      return parseFieldDefinitionNode(
        field,
        ObjectTypeKind.Object,
        referencedTypes,
      );
    } else {
      return parseFieldDefinitionNode(
        field,
        ObjectTypeKind.Input,
        referencedTypes,
      );
    }
  }

  // We always start with an empty array of FieldDescriptor elements and we
  // populate the array based on whether the result of parserIteratee is
  // empty or not.
  let fields: FieldDescriptor[] = [];

  if (nodeDescriptor.fields) {
    for (const field of nodeDescriptor.fields) {
      const fieldDescriptor = parserIteratee(field);

      fieldDescriptor !== undefined && fields.push(fieldDescriptor);
    }
  }

  const commonResults: ObjectDescriptorBase = {
    objectType:
      nodeDescriptor.kind === 'ObjectTypeDefinition' ||
      nodeDescriptor.kind === 'ObjectTypeExtension'
        ? ObjectTypeKind.Object
        : ObjectTypeKind.Input,
    name: nodeDescriptor.name.value,
    fields,
    referencedTypes,
  };

  // Mount the parsed object.
  if (
    nodeDescriptor.kind === 'ObjectTypeDefinition' ||
    nodeDescriptor.kind === 'InputObjectTypeDefinition'
  ) {
    return {
      ...commonResults,
      kind: 'ObjectTypeDescriptor',
      comments: nodeDescriptor.description && nodeDescriptor.description.value,
    };
  } else {
    return {
      ...commonResults,
      kind: 'ObjectExtensionsDescriptor',
    };
  }
}

export function parseDocumentEnumType(
  enumDesc: EnumTypeDefinitionNode,
): EnumTypeDescriptor {
  const fields = enumDesc.values
    ? enumDesc.values.map(value => ({
        originalName: value.name.value,
        comments: value.description && value.description.value,
      }))
    : [];

  return {
    kind: 'EnumTypeDescriptor',
    name: enumDesc.name.value,
    comments: enumDesc.description && enumDesc.description.value,
    fields,
  };
}

export function parseDocumentUnionType(
  unionDesc: UnionTypeDefinitionNode,
): UnionTypeDescriptor {
  const members = unionDesc.types
    ? unionDesc.types.map(type => type.name.value)
    : [];

  return {
    kind: 'UnionTypeDescriptor',
    name: unionDesc.name.value,
    comments: unionDesc.description && unionDesc.description.value,
    members,
    referencedTypes: new Set(members),
  };
}
