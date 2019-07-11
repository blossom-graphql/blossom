/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  EnumTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  SchemaDefinitionNode,
  InterfaceTypeDefinitionNode,
} from 'graphql';

import {
  BLOSSOM_IMPLEMENTATION_DIRECTIVE,
  BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME,
  IntermediateDictionary,
  KnownScalarTypes,
  ObjectTypeKind,
  parseFieldDefinitionNode,
  parseFieldType,
  thunkTypeFromDirectives,
  ThunkType,
  ThunkImplementationType,
  parseDocumentObjectType,
  parseDocumentNode,
} from '../parsing';
import {
  UnknownTypeError,
  UnsupportedOperationError,
  SchemaCollisionError,
  OperationTypeCollisionError,
} from '../errors';

describe(thunkTypeFromDirectives, () => {
  const baseField = {
    kind: 'FieldDefinition' as 'FieldDefinition',
    name: {
      kind: 'Name' as 'Name',
      value: 'test',
    },
    type: {
      kind: 'NamedType' as 'NamedType',
      name: {
        kind: 'Name' as 'Name',
        value: 'Test',
      },
    },
  };

  const argument = {
    kind: 'InputValueDefinition' as 'InputValueDefinition',
    name: { kind: 'Name' as 'Name', value: 'test' },
    type: {
      kind: 'NamedType' as 'NamedType',
      name: {
        kind: 'Name' as 'Name',
        value: 'Test',
      },
    },
  };

  const blossomImplDirective = (
    value: ThunkImplementationType,
    argumentType: 'StringValue' | 'EnumValue' | 'AnotherValue',
  ) => ({
    kind: 'Directive' as 'Directive',
    name: {
      kind: 'Name' as 'Name',
      value: BLOSSOM_IMPLEMENTATION_DIRECTIVE,
    },
    arguments: [
      {
        kind: 'Argument' as 'Argument',
        name: {
          kind: 'Name' as 'Name',
          value: BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME,
        },
        value: { kind: argumentType as 'StringValue', value: value as string },
      },
    ],
  });

  test('must return ThunkType.None when no arguments and directives are passed', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: undefined,
      }),
    ).toBe(ThunkType.None);

    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: [],
        directives: [],
      }),
    ).toBe(ThunkType.None);
  });

  test('must return ThunkType.Function when arguments are passed and no directives are passed', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: [argument],
        directives: undefined,
      }),
    ).toBe(ThunkType.Function);

    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: [argument],
        directives: [],
      }),
    ).toBe(ThunkType.Function);
  });

  test('must return ThunkType.None with no arguments and no blossom implementation directive', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
        ],
      }),
    ).toBe(ThunkType.None);
  });

  test('must return ThunkType.None when no arguments are passed and directive has wrong argument', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive' as 'Directive',
            name: {
              kind: 'Name' as 'Name',
              value: BLOSSOM_IMPLEMENTATION_DIRECTIVE,
            },
            arguments: [
              {
                kind: 'Argument' as 'Argument',
                name: {
                  kind: 'Name' as 'Name',
                  value: BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME + 'WRONG',
                },
                value: { kind: 'StringValue', value: 'whatever' },
              },
            ],
          },
        ],
      }),
    ).toBe(ThunkType.None);
  });

  test('must return ThunkType.None with no arguments and blossom implementation directive (as None)', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
          blossomImplDirective(ThunkImplementationType.None, 'StringValue'),
        ],
      }),
    ).toBe(ThunkType.None);

    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
          blossomImplDirective(ThunkImplementationType.None, 'EnumValue'),
        ],
      }),
    ).toBe(ThunkType.None);
  });

  test('must return ThunkType.Function with no arguments and blossom implementation directive (as Function)', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
          blossomImplDirective(ThunkImplementationType.Function, 'StringValue'),
        ],
      }),
    ).toBe(ThunkType.Function);

    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
          blossomImplDirective(ThunkImplementationType.Function, 'EnumValue'),
        ],
      }),
    ).toBe(ThunkType.Function);
  });

  test('must return ThunkType.AsyncFunction with no arguments and blossom implementation directive (as Async)', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
          blossomImplDirective(ThunkImplementationType.AsyncFunction, 'StringValue'),
        ],
      }),
    ).toBe(ThunkType.AsyncFunction);

    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
          blossomImplDirective(ThunkImplementationType.AsyncFunction, 'EnumValue'),
        ],
      }),
    ).toBe(ThunkType.AsyncFunction);
  });

  test('must return ThunkType.None with no arguments and blossom implementation directive (as another value)', () => {
    expect(
      thunkTypeFromDirectives({
        ...baseField,
        arguments: undefined,
        directives: [
          {
            kind: 'Directive',
            name: {
              kind: 'Name',
              value: 'testDirective',
            },
          },
          blossomImplDirective(ThunkImplementationType.AsyncFunction, 'AnotherValue'),
        ],
      }),
    ).toBe(ThunkType.None);
  });
});

describe(parseFieldType, () => {
  const emptyIntermediateDict: IntermediateDictionary = {
    objects: {},
    inputs: {},
    enums: {},
    operationNames: {},
  };

  test('must return KnownScalarTypes.String for GraphQL ID type', () => {
    expect(
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'ID',
          },
        },
        emptyIntermediateDict,
      ),
    ).toEqual({
      kind: 'KnownScalarType',
      type: KnownScalarTypes.String,
    });
  });

  test('must return KnownScalarTypes.String for GraphQL String type', () => {
    expect(
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'String',
          },
        },
        emptyIntermediateDict,
      ),
    ).toEqual({
      kind: 'KnownScalarType',
      type: KnownScalarTypes.String,
    });
  });

  test('must return KnownScalarTypes.Number for GraphQL Int type', () => {
    expect(
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'Int',
          },
        },
        emptyIntermediateDict,
      ),
    ).toEqual({
      kind: 'KnownScalarType',
      type: KnownScalarTypes.Number,
    });
  });

  test('must return KnownScalarTypes.Number for GraphQL Float type', () => {
    expect(
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'Float',
          },
        },
        emptyIntermediateDict,
      ),
    ).toEqual({
      kind: 'KnownScalarType',
      type: KnownScalarTypes.Number,
    });
  });

  test('must return KnownScalarTypes.Boolean for GraphQL Boolean type', () => {
    expect(
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'Boolean',
          },
        },
        emptyIntermediateDict,
      ),
    ).toEqual({
      kind: 'KnownScalarType',
      type: KnownScalarTypes.Boolean,
    });
  });

  test('must throw UnknownTypeError when a referenced type is not available in the intermediate dictionary', () => {
    expect(() =>
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'WhateverName',
          },
        },
        emptyIntermediateDict,
      ),
    ).toThrowError(UnknownTypeError);

    expect(() =>
      parseFieldType(
        ObjectTypeKind.Input, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'WhateverName',
          },
        },
        emptyIntermediateDict,
      ),
    ).toThrowError(UnknownTypeError);
  });

  test('must return correct referenced type when the definition is available in objects', () => {
    const intermediateDictWithObject: IntermediateDictionary = {
      objects: {
        TestObject: {
          originFile: 'test-origin.gql',
          node: {
            kind: 'ObjectTypeDefinition',
            name: {
              kind: 'Name',
              value: 'TestObject',
            },
          },
        },
      },
      inputs: {},
      enums: {},
      operationNames: {},
    };

    expect(
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'TestObject',
          },
        },
        intermediateDictWithObject,
      ),
    ).toEqual({
      kind: 'ReferencedType',
      name: 'TestObject',
    });
  });

  test('must return correct referenced type when the definition is available in enums', () => {
    const intermediateDictWithEnum: IntermediateDictionary = {
      objects: {},
      inputs: {},
      enums: {
        TestEnum: {
          originFile: 'test-origin.gql',
          node: {
            kind: 'EnumTypeDefinition',
            name: {
              kind: 'Name',
              value: 'TestEnum',
            },
          },
        },
      },
      operationNames: {},
    };

    expect(
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'TestEnum',
          },
        },
        intermediateDictWithEnum,
      ),
    ).toEqual({
      kind: 'ReferencedType',
      name: 'TestEnum',
    });

    expect(
      parseFieldType(
        ObjectTypeKind.Input, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'TestEnum',
          },
        },
        intermediateDictWithEnum,
      ),
    ).toEqual({
      kind: 'ReferencedType',
      name: 'TestEnum',
    });
  });

  test('must return correct referenced type when the definition is available in inputs', () => {
    const intermediateDictWithInput: IntermediateDictionary = {
      objects: {},
      inputs: {
        TestInput: {
          originFile: 'test-origin.gql',
          node: {
            kind: 'InputObjectTypeDefinition',
            name: {
              kind: 'Name',
              value: 'TestInput',
            },
          },
        },
      },
      enums: {},
      operationNames: {},
    };

    expect(
      parseFieldType(
        ObjectTypeKind.Input, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'TestInput',
          },
        },
        intermediateDictWithInput,
      ),
    ).toEqual({
      kind: 'ReferencedType',
      name: 'TestInput',
    });
  });

  test('must return throw UnknownTypeError when referenced type is in inputs', () => {
    const intermediateDictWithInput: IntermediateDictionary = {
      objects: {},
      inputs: {
        TestInput: {
          originFile: 'test-origin.gql',
          node: {
            kind: 'InputObjectTypeDefinition',
            name: {
              kind: 'Name',
              value: 'TestInput',
            },
          },
        },
      },
      enums: {},
      operationNames: {},
    };

    expect(() =>
      parseFieldType(
        ObjectTypeKind.Object, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'TestInput',
          },
        },
        intermediateDictWithInput,
      ),
    ).toThrowError(UnknownTypeError);
  });

  test('must return throw UnknownTypeError when referenced type is in objects', () => {
    const intermediateDictWithInput: IntermediateDictionary = {
      objects: {
        TestObject: {
          originFile: 'test-origin.gql',
          node: {
            kind: 'ObjectTypeDefinition',
            name: {
              kind: 'Name',
              value: 'TestObject',
            },
          },
        },
      },
      inputs: {},
      enums: {},
      operationNames: {},
    };

    expect(() =>
      parseFieldType(
        ObjectTypeKind.Input, // whatever, shouldn't matter for this case
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'TestObject',
          },
        },
        intermediateDictWithInput,
      ),
    ).toThrowError(UnknownTypeError);
  });
});

describe(parseFieldDefinitionNode, () => {
  const intermediateDict: IntermediateDictionary = {
    objects: {
      TestType: {
        node: {
          kind: 'ObjectTypeDefinition',
          name: {
            kind: 'Name',
            value: 'TestType',
          },
        },
      },
    },
    inputs: {
      TestInput: {
        node: {
          kind: 'InputObjectTypeDefinition',
          name: {
            kind: 'Name',
            value: 'TestInput',
          },
        },
      },
    },
    enums: {},
    operationNames: {},
  };

  const fieldTypeReturn = {
    kind: 'ReferencedType',
    name: 'TestType',
  };

  test('must return correct values when definiton has a NamedType kind', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: 'TestType',
          },
        },
        ObjectTypeKind.Object,
        intermediateDict,
      ),
    ).toEqual({
      name: 'TestType',
      type: fieldTypeReturn,
      thunkType: ThunkType.None,
      array: false,
      required: false,
    });
  });

  test('must return correct values when definiton has a NonNullType kind', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'NonNullType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'TestType',
            },
          },
        },
        ObjectTypeKind.Object,
        intermediateDict,
      ),
    ).toEqual({
      name: 'TestType',
      type: fieldTypeReturn,
      thunkType: ThunkType.None,
      array: false,
      required: true,
    });
  });

  test('must return correct values when definiton has a ListType kind', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'ListType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'TestType',
            },
          },
        },
        ObjectTypeKind.Object,
        intermediateDict,
      ),
    ).toEqual({
      name: '',
      thunkType: ThunkType.None,
      array: true,
      required: false,
      elementDescriptor: {
        name: 'TestType',
        type: fieldTypeReturn,
        thunkType: ThunkType.None,
        array: false,
        required: false,
      },
    });
  });

  // FieldDefinition - no arguments - directive
  // => arguments list MUST be empty
  // => ThunkType must be Function
  test('must return correct value for FieldDefinition / No Arguments / Implementation Directive', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'FieldDefinition',
          description: {
            kind: 'StringValue',
            value: 'Test description',
          },
          name: {
            kind: 'Name',
            value: 'testField',
          },
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'TestType',
            },
          },
          directives: [
            {
              kind: 'Directive',
              name: {
                kind: 'Name',
                value: BLOSSOM_IMPLEMENTATION_DIRECTIVE,
              },
              arguments: [
                {
                  kind: 'Argument',
                  name: {
                    kind: 'Name',
                    value: BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME,
                  },
                  value: {
                    kind: 'StringValue',
                    value: ThunkImplementationType.Function,
                  },
                },
              ],
            },
          ],
        },
        ObjectTypeKind.Object,
        intermediateDict,
      ),
    ).toEqual({
      name: 'testField',
      comments: 'Test description',
      elementDescriptor: undefined,
      array: false,
      required: false,
      arguments: [],
      thunkType: ThunkType.Function,
      type: {
        kind: 'ReferencedType',
        name: 'TestType',
      },
    });
  });

  // FieldDefinition - no arguments - no directives
  // => arguments list MUST be empty
  // => ThunkType must be None
  test('must return correct value for FieldDefinition / No Arguments / No Directives', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'FieldDefinition',
          description: {
            kind: 'StringValue',
            value: 'Test description',
          },
          name: {
            kind: 'Name',
            value: 'testField',
          },
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'TestType',
            },
          },
        },
        ObjectTypeKind.Object,
        intermediateDict,
      ),
    ).toEqual({
      name: 'testField',
      comments: 'Test description',
      elementDescriptor: undefined,
      array: false,
      required: false,
      arguments: [],
      thunkType: ThunkType.None,
      type: {
        kind: 'ReferencedType',
        name: 'TestType',
      },
    });
  });

  // FieldDefinition - arguments - no directives
  // => arguments list MUST NOT be empty
  // => ThunkType must be Function (because of arguments)
  test('must return correct value for FieldDefinition / Arguments / No Directives', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'FieldDefinition',
          description: {
            kind: 'StringValue',
            value: 'Test description',
          },
          name: {
            kind: 'Name',
            value: 'testField',
          },
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'TestType',
            },
          },
          arguments: [
            {
              kind: 'InputValueDefinition',
              name: {
                kind: 'Name',
                value: 'testArg',
              },
              type: {
                kind: 'NamedType',
                name: {
                  kind: 'Name',
                  value: 'TestInput',
                },
              },
            },
          ],
        },
        ObjectTypeKind.Object,
        intermediateDict,
      ),
    ).toEqual({
      name: 'testField',
      comments: 'Test description',
      elementDescriptor: undefined,
      array: false,
      required: false,
      arguments: [
        {
          name: 'testArg',
          elementDescriptor: undefined,
          comments: undefined,
          arguments: [],
          array: false,
          required: false,
          thunkType: ThunkType.None,
          type: {
            kind: 'ReferencedType',
            name: 'TestInput',
          },
        },
      ],
      thunkType: ThunkType.Function,
      type: {
        kind: 'ReferencedType',
        name: 'TestType',
      },
    });
  });

  // InputValueDefinition - no arguments - directive
  // => arguments list MUST NOT be empty
  // => ThunkType must be None (we don't care about directives here)
  test('must return correct value for InputTypeDefinition / No Arguments / Implementation Directive', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'InputValueDefinition',
          description: {
            kind: 'StringValue',
            value: 'Test description',
          },
          name: {
            kind: 'Name',
            value: 'testField',
          },
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'TestInput',
            },
          },
          directives: [
            {
              kind: 'Directive',
              name: {
                kind: 'Name',
                value: BLOSSOM_IMPLEMENTATION_DIRECTIVE,
              },
              arguments: [
                {
                  kind: 'Argument',
                  name: {
                    kind: 'Name',
                    value: BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME,
                  },
                  value: {
                    kind: 'StringValue',
                    value: ThunkImplementationType.Function,
                  },
                },
              ],
            },
          ],
        },
        ObjectTypeKind.Input,
        intermediateDict,
      ),
    ).toEqual({
      name: 'testField',
      comments: 'Test description',
      elementDescriptor: undefined,
      array: false,
      required: false,
      arguments: [],
      thunkType: ThunkType.None,
      type: {
        kind: 'ReferencedType',
        name: 'TestInput',
      },
    });
  });

  // InputValueDefinition - no arguments - no directives
  // => arguments list MUST be empty
  // => ThunkType must be None
  test('must return correct value for InputValueDefinition / No Arguments / No Directives', () => {
    expect(
      parseFieldDefinitionNode(
        {
          kind: 'InputValueDefinition',
          description: {
            kind: 'StringValue',
            value: 'Test description',
          },
          name: {
            kind: 'Name',
            value: 'testField',
          },
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'TestInput',
            },
          },
        },
        ObjectTypeKind.Input,
        intermediateDict,
      ),
    ).toEqual({
      name: 'testField',
      comments: 'Test description',
      elementDescriptor: undefined,
      array: false,
      required: false,
      arguments: [],
      thunkType: ThunkType.None,
      type: {
        kind: 'ReferencedType',
        name: 'TestInput',
      },
    });
  });
});

const OBJECT_NAME = 'TestObject';
const DESCRIPTION = 'Test description';

describe(parseDocumentObjectType, () => {
  const EMPTY_INTERMEDIATE_DICT: IntermediateDictionary = {
    objects: {},
    inputs: {},
    enums: {},
    operationNames: {},
  };

  test('must return correct values for an ObjectTypeDefinition with no fields', () => {
    expect(
      parseDocumentObjectType(
        {
          kind: 'ObjectTypeDefinition',
          description: {
            kind: 'StringValue',
            value: DESCRIPTION,
          },
          name: {
            kind: 'Name',
            value: OBJECT_NAME,
          },
        },
        EMPTY_INTERMEDIATE_DICT,
      ),
    ).toEqual({
      name: OBJECT_NAME,
      comments: DESCRIPTION,
      fields: [],
    });
  });

  test('must return correct values for an ObjectTypeDefinition with fields', () => {
    expect(
      parseDocumentObjectType(
        {
          kind: 'ObjectTypeDefinition',
          description: {
            kind: 'StringValue',
            value: DESCRIPTION,
          },
          name: {
            kind: 'Name',
            value: OBJECT_NAME,
          },
          fields: [
            {
              kind: 'FieldDefinition',
              name: {
                kind: 'Name',
                value: 'testField',
              },
              type: {
                kind: 'NamedType',
                name: { kind: 'Name', value: 'String' },
              },
            },
          ],
        },
        EMPTY_INTERMEDIATE_DICT,
      ),
    ).toEqual({
      name: OBJECT_NAME,
      comments: DESCRIPTION,
      fields: [
        {
          array: false,
          required: false,
          name: 'testField',
          comments: undefined,
          elementDescriptor: undefined,
          thunkType: ThunkType.None,
          type: {
            kind: 'KnownScalarType',
            type: KnownScalarTypes.String,
          },
          arguments: [],
        },
      ],
    });
  });

  test('must return correct values for an InputObjectTypeDefinition with fields', () => {
    expect(
      parseDocumentObjectType(
        {
          kind: 'InputObjectTypeDefinition',
          description: {
            kind: 'StringValue',
            value: DESCRIPTION,
          },
          name: {
            kind: 'Name',
            value: OBJECT_NAME,
          },
          fields: [
            {
              kind: 'InputValueDefinition',
              name: {
                kind: 'Name',
                value: 'testField',
              },
              type: {
                kind: 'NamedType',
                name: { kind: 'Name', value: 'String' },
              },
            },
          ],
        },
        EMPTY_INTERMEDIATE_DICT,
      ),
    ).toEqual({
      name: OBJECT_NAME,
      comments: DESCRIPTION,
      fields: [
        {
          array: false,
          required: false,
          name: 'testField',
          comments: undefined,
          elementDescriptor: undefined,
          thunkType: ThunkType.None,
          type: {
            kind: 'KnownScalarType',
            type: KnownScalarTypes.String,
          },
          arguments: [],
        },
      ],
    });
  });
});

describe(parseDocumentNode, () => {
  test('must return a correctly parsed object', () => {
    const definition: ObjectTypeDefinitionNode = {
      kind: 'ObjectTypeDefinition',
      description: {
        kind: 'StringValue',
        value: DESCRIPTION,
      },
      name: {
        kind: 'Name',
        value: OBJECT_NAME,
      },
    };

    const result = parseDocumentNode({
      kind: 'Document',
      definitions: [definition],
    });

    expect(result.objects).toEqual([
      {
        name: OBJECT_NAME,
        comments: DESCRIPTION,
        fields: [],
      },
    ]);

    expect(result.intermediateDict.objects[OBJECT_NAME].node).toEqual(definition);
  });

  test('must return a correctly parsed input', () => {
    const definition: InputObjectTypeDefinitionNode = {
      kind: 'InputObjectTypeDefinition',
      description: {
        kind: 'StringValue',
        value: DESCRIPTION,
      },
      name: {
        kind: 'Name',
        value: OBJECT_NAME,
      },
    };

    const result = parseDocumentNode({
      kind: 'Document',
      definitions: [definition],
    });

    expect(result.inputs).toEqual([
      {
        name: OBJECT_NAME,
        comments: DESCRIPTION,
        fields: [],
      },
    ]);

    expect(result.intermediateDict.inputs[OBJECT_NAME].node).toEqual(definition);
  });

  test('must do nothing with an unhandled DefinitionNode', () => {
    // Not planned to be supported anytime soon.
    const definition: InterfaceTypeDefinitionNode = {
      kind: 'InterfaceTypeDefinition',
      name: {
        kind: 'Name',
        value: 'TestInterface',
      },
    };

    const result = parseDocumentNode({
      kind: 'Document',
      definitions: [definition],
    });

    expect(result.intermediateDict.objects).toEqual({});
    expect(result.intermediateDict.inputs).toEqual({});
    expect(result.intermediateDict.enums).toEqual({});
    expect(result.intermediateDict.schema).toBeUndefined();
    expect(result.intermediateDict.operationNames).toEqual({});
  });

  test('must consolidate SchemaDefinitions in schema field when parseSchema is true', () => {
    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'query',
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Test' } },
        },
      ],
    };

    const result = parseDocumentNode(
      {
        kind: 'Document',
        definitions: [definition],
      },
      undefined,
      undefined,
      true,
    );

    expect(result.intermediateDict.schema).toEqual(definition);
  });

  test('must NOT consolidate SchemaDefinitions in schema field when parseSchema is false', () => {
    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'query',
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Test' } },
        },
      ],
    };

    const result = parseDocumentNode(
      {
        kind: 'Document',
        definitions: [definition],
      },
      undefined,
      undefined,
      false,
    );

    // Must be undefined since we are starting from an empty intermediate dict
    expect(result.intermediateDict.schema).not.toBeDefined();
  });

  test('must consolidate enums on intermediateDictionary', () => {
    const definition: EnumTypeDefinitionNode = {
      kind: 'EnumTypeDefinition',
      name: {
        kind: 'Name',
        value: 'TestEnum',
      },
    };

    const result = parseDocumentNode({
      kind: 'Document',
      definitions: [definition],
    });

    expect(result.intermediateDict.enums['TestEnum'].node).toEqual(definition);
  });

  test('must not set operationNames when no definitions are passed', () => {
    const result = parseDocumentNode(
      {
        kind: 'Document',
        definitions: [],
      },
      undefined,
      undefined,
      false,
    );

    expect(result.intermediateDict.operationNames.query).toBeUndefined();
    expect(result.intermediateDict.operationNames.mutation).toBeUndefined();
  });

  test('must set operationNames for query when is defined and parseSchema is true', () => {
    const NAME = 'Test';

    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'query',
          type: { kind: 'NamedType', name: { kind: 'Name', value: NAME } },
        },
      ],
    };

    const result = parseDocumentNode(
      {
        kind: 'Document',
        definitions: [definition],
      },
      undefined,
      undefined,
      true,
    );

    expect(result.intermediateDict.operationNames.query).toEqual(NAME);
  });

  test('must NOT set operationNames for query when is defined and parseSchema is false', () => {
    const NAME = 'Test';

    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'query',
          type: { kind: 'NamedType', name: { kind: 'Name', value: NAME } },
        },
      ],
    };

    const result = parseDocumentNode(
      {
        kind: 'Document',
        definitions: [definition],
      },
      undefined,
      undefined,
      false,
    );

    expect(result.intermediateDict.operationNames.query).toBeUndefined();
  });

  test('must set operationNames for mutation when is defined and parseSchema is true', () => {
    const NAME = 'Test';

    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'mutation',
          type: { kind: 'NamedType', name: { kind: 'Name', value: NAME } },
        },
      ],
    };

    const result = parseDocumentNode(
      {
        kind: 'Document',
        definitions: [definition],
      },
      undefined,
      undefined,
      true,
    );

    expect(result.intermediateDict.operationNames.mutation).toEqual(NAME);
  });

  test('must NOT set operationNames for mutation when is defined and parseSchema is false', () => {
    const NAME = 'Test';

    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'mutation',
          type: { kind: 'NamedType', name: { kind: 'Name', value: NAME } },
        },
      ],
    };

    const result = parseDocumentNode(
      {
        kind: 'Document',
        definitions: [definition],
      },
      undefined,
      undefined,
      false,
    );

    expect(result.intermediateDict.operationNames.mutation).toBeUndefined();
  });

  test('must throw UnsupportedOperationError when operation is not supported and parseSchema is true', () => {
    const NAME = 'Test';

    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'subscription',
          type: { kind: 'NamedType', name: { kind: 'Name', value: NAME } },
        },
      ],
    };

    expect(() =>
      parseDocumentNode(
        {
          kind: 'Document',
          definitions: [definition],
        },
        undefined,
        undefined,
        true,
      ),
    ).toThrowError(UnsupportedOperationError);
  });

  test('must NOT throw UnsupportedOperationError when operation is not supported and parseSchema is false', () => {
    const NAME = 'Test';

    const definition: SchemaDefinitionNode = {
      kind: 'SchemaDefinition',
      operationTypes: [
        {
          kind: 'OperationTypeDefinition',
          operation: 'subscription',
          type: { kind: 'NamedType', name: { kind: 'Name', value: NAME } },
        },
      ],
    };

    expect(() =>
      parseDocumentNode(
        {
          kind: 'Document',
          definitions: [definition],
        },
        undefined,
        undefined,
        false,
      ),
    ).not.toThrowError(UnsupportedOperationError);
  });

  test('must throw SchemaCollisionError when parseSchema is true and a new schema is sent', () => {
    expect(() =>
      parseDocumentNode(
        {
          kind: 'Document',
          definitions: [
            {
              kind: 'SchemaDefinition',
              operationTypes: [
                {
                  kind: 'OperationTypeDefinition',
                  operation: 'query',
                  type: {
                    kind: 'NamedType',
                    name: {
                      kind: 'Name',
                      value: 'TestQuery',
                    },
                  },
                },
              ],
            },
          ],
        },
        undefined,
        {
          objects: {},
          inputs: {},
          enums: {},
          operationNames: {},
          schema: {
            kind: 'SchemaDefinition',
            operationTypes: [],
          },
        },
        true,
      ),
    ).toThrowError(SchemaCollisionError);
  });

  test('must throw OperationTypeCollisionError when parseSchema is true and operationTypes are already defined', () => {
    expect(() =>
      parseDocumentNode(
        {
          kind: 'Document',
          definitions: [
            {
              kind: 'SchemaDefinition',
              operationTypes: [
                {
                  kind: 'OperationTypeDefinition',
                  operation: 'query',
                  type: {
                    kind: 'NamedType',
                    name: {
                      kind: 'Name',
                      value: 'TestQuery',
                    },
                  },
                },
              ],
            },
          ],
        },
        undefined,
        {
          objects: {},
          inputs: {},
          enums: {},
          operationNames: {
            // This is on purposes. Even another definition must trigger it.
            mutation: 'TestMutation',
          },
        },
        true,
      ),
    ).toThrowError(OperationTypeCollisionError);
  });
});
