/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

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
} from 'graphql';

export const BLOSSOM_IMPLEMENTATION_DIRECTIVE = 'blossomImpl';
export const BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME = 'type';

/**
 * Descriptor of a document node.
 */
type DocumentNodeDescriptor<T> = {
  /**
   * Full descriptor.
   */
  node: T;
  /**
   * **Absolute** path of the file where this definition can be found.
   */
  originFile?: string;
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
   * The node that is defining the schema on this file.
   */
  schema?: SchemaDefinitionNode;
  /**
   * The key inside objects that containes the ObjectDefinitionNode for the
   * query operation in the schema declaration.
   */
  queryType?: string;
  /**
   * The key inside objects that containes the ObjectDefinitionNode for the
   * query operation in the schema declaration.
   */
  mutationType?: string;
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

/**
 * Full descriptor of a single type entry.
 */
type SingleFieldDescriptor = {
  /**
   * Is this an array? Always false. Used for type guards.
   */
  array: false;
  name: string;
  comments?: string;
  type: KnownScalarTypeDescriptor | ReferencedTypeDescriptor;
  /**
   * Is it required to return the field?
   */
  required: boolean;
  thunkType: ThunkType;
  arguments?: FieldDescriptor[];
};

/**
 * Full descriptor of an array field.
 */
type ArrayFieldDescriptor = {
  /**
   * Is this an array? Always true. Used for type guards.
   */
  array: true;
  name: string;
  comments?: string;
  /**
   * Is it required to always return the array? Even though it's empty?
   */
  required: boolean;
  thunkType: ThunkType;
  /**
   * Descriptor of a single element of the array.
   */
  elementDescriptor: FieldDescriptor;
  arguments?: FieldDescriptor[];
};

/**
 * The full description of a field on a type or input declaration. This can be
 * either a single field declaration or an array declaration. This is
 * determined by the `array` property.
 */
export type FieldDescriptor = SingleFieldDescriptor | ArrayFieldDescriptor;

/**
 * Enum containing all the known scalar types. Used internally in `switch`
 * statements used in codegen.
 */
export enum KnownScalarTypes {
  String = 'string',
  Boolean = 'boolean',
  Number = 'number',
}

export enum ThunkImplementationType {
  AsyncFunction = 'async',
  Function = 'function',
  None = 'none',
}

/**
 * Descriptor for a known scalar type.
 */
type KnownScalarTypeDescriptor = {
  kind: 'KnownScalarType';
  type: KnownScalarTypes;
};

/**
 * Descriptor for a referenced type descriptor.
 */
type ReferencedTypeDescriptor = {
  kind: 'ReferencedType';
  name: string;
};

/**
 * Full description of an object type. Any `type` and `input` declaration in
 * GraphQL objects is collapsed into this data structure which in turned is
 * then consumed for codegen purposes.
 */
export type ObjectTypeDescription = {
  name: string;
  comments?: string;
  fields: FieldDescriptor[];
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

// Extra operators can be added in the future.
const SUPPORTED_OPERATION_TYPES = ['query', 'mutation'];

/**
 * Receives a GraphQL.js document node and returns a data structure containing
 * all the parsed types and root values.
 *
 * @param document DocumentNode coming from the parsed GraphQL schema.
 *
 * @param originFile Name of the file that was the origin for this definition.
 */
export function parseDocumentNode(document: DocumentNode, originFile?: string) {
  const intermediateDict: IntermediateDictionary = {
    objects: {},
    inputs: {},
    enums: {},
    schema: undefined,
    queryType: undefined,
    mutationType: undefined,
  };

  // Collapse parseable definitions into the IntermediateDictionary.
  document.definitions.forEach(definition => {
    switch (definition.kind) {
      case 'ObjectTypeDefinition':
        intermediateDict.objects[definition.name.value] = {
          node: definition,
          originFile,
        };
        break;
      case 'InputObjectTypeDefinition':
        intermediateDict.inputs[definition.name.value] = {
          node: definition,
          originFile,
        };
        break;
      case 'SchemaDefinition':
        intermediateDict.schema = definition;
        break;
      case 'EnumTypeDefinition':
        intermediateDict.enums[definition.name.value] = {
          node: definition,
          originFile,
        };
        break;
      // Do nothing
      default:
        break;
    }
  });

  // TODO: Resolve other schemas WITHOUT considering the schema {} statement.

  // If there's a schema definition in the IntermediateDictionary, check that
  // the types are properly defined in the objects map.
  intermediateDict.schema &&
    intermediateDict.schema.operationTypes.forEach(operation => {
      if (!SUPPORTED_OPERATION_TYPES.includes(operation.operation)) {
        throw new Error(`Unsupported operation type ${operation.operation}.`);
      }

      if (!intermediateDict.objects.hasOwnProperty(operation.type.name.value)) {
        throw new Error(
          `Type ${
            operation.type.name.value
          } not defined in this file for this schema.`,
        );
      }

      // Send back to the corresponding type
      if (operation.operation === 'query') {
        intermediateDict.queryType = operation.type.name.value;
      } else if (operation.operation === 'mutation') {
        intermediateDict.mutationType = operation.type.name.value;
      }
    });

  // Return the parsed AST for the objects
  return {
    objects: Object.values(intermediateDict.objects)
      .map(object => parseDocumentObjectType(object.node, intermediateDict))
      .filter(result => result !== null) as ObjectTypeDescription[],
    inputs: Object.values(intermediateDict.inputs)
      .map(input => parseDocumentObjectType(input.node, intermediateDict))
      .filter(result => result !== null) as ObjectTypeDescription[],
  };
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
 * @param kind The kind of field. This will be used to access the
 * intermediateDict and find whether the type will be available on the file.
 *
 * @param type Definition of the type.
 *
 * @param intermediateDict Intermediate dictionary with all the available
 * definitions for this document parsing.
 */
export function parseFieldType(
  kind: ObjectTypeKind,
  type: NamedTypeNode,
  intermediateDict: IntermediateDictionary,
): KnownScalarTypeDescriptor | ReferencedTypeDescriptor {
  const name = type.name.value;

  switch (name) {
    case 'ID':
    case 'String':
      return { kind: 'KnownScalarType', type: KnownScalarTypes.String };
    case 'Int':
    case 'Float':
      return { kind: 'KnownScalarType', type: KnownScalarTypes.Number };
    case 'Boolean':
      return { kind: 'KnownScalarType', type: KnownScalarTypes.Boolean };
    default:
      const typeNotFound =
        (kind === ObjectTypeKind.Object &&
          !intermediateDict.objects.hasOwnProperty(name) &&
          !intermediateDict.enums.hasOwnProperty(name)) ||
        (kind === ObjectTypeKind.Input &&
          !intermediateDict.inputs.hasOwnProperty(name) &&
          !intermediateDict.enums.hasOwnProperty(name));

      if (typeNotFound) {
        throw new Error(
          `Cannot find reference for type ${name}. Did you spell it correctly? If this type is defined in another schema file, please import it on top.`,
        );
      }

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
  intermediateDict: IntermediateDictionary,
): FieldDescriptor {
  if (definition.kind === 'ListType') {
    // A list. We must enforce that array is true in this case and then recurse
    // to set the behavior of the element.
    const result = parseFieldDefinitionNode(
      definition.type,
      kind,
      intermediateDict,
    ) as FieldDescriptor;

    return {
      name: '',
      required: false,
      array: true,
      elementDescriptor: result,
      thunkType: ThunkType.None,
    };
  } else if (definition.kind === 'NonNullType') {
    // Non null type. Result will be defined by recursing into definition.type.
    // However, required must be forced to be true.

    const result = parseFieldDefinitionNode(
      definition.type,
      kind,
      intermediateDict,
    ) as FieldDescriptor;

    return {
      ...result,
      required: true,
    };
  } else if (definition.kind === 'NamedType') {
    // Named type is the base result value. From here we just need to retrieve
    // the type in order to match it with any of the references.

    return {
      name: definition.name.value,
      type: parseFieldType(kind, definition, intermediateDict),
      thunkType: ThunkType.None,
      array: false,
      required: false,
    };
  } else {
    // One of the base types incoming. We set the common elements and recurse
    // by calling this same function with definition.type.

    // Parse arguments
    let args: FieldDescriptor[] | undefined;

    if (
      definition.kind === 'FieldDefinition' &&
      definition.arguments &&
      definition.arguments.length > 0
    ) {
      args = definition.arguments.map(argument =>
        parseFieldDefinitionNode(
          argument,
          ObjectTypeKind.Input,
          intermediateDict,
        ),
      );
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
      intermediateDict,
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
 * @param type Definition structure of the object / input object type.
 *
 * @param intermediateDict Intermediate dictionary where all the parsed
 * definitions of all the involved files are collapsed into a Map.
 */
export function parseDocumentObjectType(
  type: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode,
  intermediateDict: IntermediateDictionary,
): ObjectTypeDescription | null {
  let fields: FieldDescriptor[] | undefined;

  if (type.kind === 'ObjectTypeDefinition') {
    const name = type.name.value;

    // We don't parse types that are part of the query or mutation types.
    // These are meant to be handled separately on root values.
    if (
      name === intermediateDict.queryType ||
      name === intermediateDict.mutationType
    ) {
      return null;
    }

    const parsedFields =
      type.fields &&
      (type.fields
        .map(field =>
          parseFieldDefinitionNode(
            field,
            ObjectTypeKind.Object,
            intermediateDict,
          ),
        )
        .filter(field => field !== undefined) as FieldDescriptor[]);

    fields = parsedFields;
  } else {
    const parsedFields =
      type.fields &&
      (type.fields
        .map(field =>
          parseFieldDefinitionNode(
            field,
            ObjectTypeKind.Input,
            intermediateDict,
          ),
        )
        .filter(field => field !== undefined) as FieldDescriptor[]);

    fields = parsedFields;
  }

  return {
    name: type.name.value,
    comments: type.description && type.description.value,
    fields: fields || ([] as FieldDescriptor[]),
  };
}
