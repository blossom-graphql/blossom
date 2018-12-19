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
  DirectiveNode,
  NamedTypeNode,
} from 'graphql';

type DocumentNodeDescriptor<T> = {
  node: T;
  originFile?: string;
};

type DocumentNameMap<T> = { [key: string]: DocumentNodeDescriptor<T> };

type IntermediateDictionary = {
  objects: DocumentNameMap<ObjectTypeDefinitionNode>;
  inputs: DocumentNameMap<InputObjectTypeDefinitionNode>;
  enums: DocumentNameMap<EnumTypeDefinitionNode>;
  schema?: SchemaDefinitionNode;
  queryType?: string;
  mutationType?: string;
};

enum ThunkType {
  asyncFunction = 'asyncFunction',
  function = 'function',
  none = 'none',
}

type FieldDescriptor = {
  name: string;
  comments?: string;
  type: KnownTypeDescriptor | ReferencedTypeDescriptor;
  array: boolean;
  required: boolean;
  thunkType: ThunkType;
  elementDescriptor?: FieldDescriptor;
};

type KnownTypeDescriptor = {
  kind: 'KnownType';
  type: 'string' | 'boolean' | 'number';
};

type ReferencedTypeDescriptor = {
  kind: 'ReferencedType';
  name: string;
};

enum ObjectTypeKind {
  Object = 'Object',
  Input = 'Input',
}

const SUPPORTED_OPERATION_TYPES = ['query', 'mutation'];

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
      .filter(result => result !== null),
    inputs: Object.values(intermediateDict.inputs)
      .map(input => parseDocumentObjectType(input.node, intermediateDict))
      .filter(result => result !== null),
  };
}

export function thunkTypeFromDirectives(
  directives: ReadonlyArray<DirectiveNode>,
) {
  const blossomImplDirective = directives.find(
    ({ name: { value } }) => value === 'blossomImpl',
  );
  if (!blossomImplDirective) {
    return ThunkType.none;
  }

  const typeArgument =
    blossomImplDirective.arguments &&
    blossomImplDirective.arguments.find(
      argument => argument.name.value === 'type',
    );
  if (!typeArgument) {
    return ThunkType.none;
  }

  if (
    typeArgument.value.kind === 'EnumValue' ||
    typeArgument.value.kind === 'StringValue'
  ) {
    switch (typeArgument.value.value) {
      case 'function':
        return ThunkType.function;
      case 'async':
        return ThunkType.asyncFunction;
      default:
        return ThunkType.none;
    }
  } else {
    return ThunkType.none;
  }
}

export function parseFieldType(
  kind: ObjectTypeKind,
  type: NamedTypeNode,
  intermediateDict: IntermediateDictionary,
): KnownTypeDescriptor | ReferencedTypeDescriptor {
  const name = type.name.value;

  switch (name) {
    case 'ID':
    case 'String':
      return { kind: 'KnownType', type: 'string' };
    case 'Int':
    case 'Float':
      return { kind: 'KnownType', type: 'number' };
    case 'Boolean':
      return { kind: 'KnownType', type: 'boolean' };
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

export function parseFieldDefinitionNode(
  definition: FieldDefinitionNode | InputValueDefinitionNode | TypeNode,
  kind: ObjectTypeKind,
  intermediateDict: IntermediateDictionary,
): FieldDescriptor | undefined {
  if (
    definition.kind === 'FieldDefinition' ||
    definition.kind === 'InputValueDefinition'
  ) {
    // One of the base types incoming. We set the common elements and recurse
    // by calling this same function with definition.type.

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
        definition.directives && kind === ObjectTypeKind.Object
          ? thunkTypeFromDirectives(definition.directives)
          : ThunkType.none,
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
  } else if (definition.kind === 'ListType') {
    // A list. We must enforce that array is true in this case and then recurse
    // to set the behavior of the element.
    const result = parseFieldDefinitionNode(
      definition.type,
      kind,
      intermediateDict,
    ) as FieldDescriptor;

    return {
      name: '',
      type: { kind: 'KnownType', type: 'boolean' },
      required: false,
      array: true,
      elementDescriptor: result,
      thunkType: ThunkType.none,
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
      thunkType: ThunkType.none,
      array: false,
      required: false,
    };
  } else {
    // Unhandled by this parser.
    return undefined;
  }
}

export function parseDocumentObjectType(
  type: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode,
  intermediateDict: IntermediateDictionary,
) {
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
    fields,
  };
}
