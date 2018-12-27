/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

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
  UnknownTypeError,
} from '../parsing';

describe('thunkTypeFromDirectives', () => {
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

  it('must return ThunkType.None when no arguments and directives are passed', () => {
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

  it('must return ThunkType.Function when arguments are passed and no directives are passed', () => {
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

  it('must return ThunkType.None with no arguments and no blossom implementation directive', () => {
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

  it('must return ThunkType.None with no arguments and blossom implementation directive (as None)', () => {
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

  it('must return ThunkType.Function with no arguments and blossom implementation directive (as Function)', () => {
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

  it('must return ThunkType.AsyncFunction with no arguments and blossom implementation directive (as Async)', () => {
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
          blossomImplDirective(
            ThunkImplementationType.AsyncFunction,
            'StringValue',
          ),
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
          blossomImplDirective(
            ThunkImplementationType.AsyncFunction,
            'EnumValue',
          ),
        ],
      }),
    ).toBe(ThunkType.AsyncFunction);
  });

  it('must return ThunkType.None with no arguments and blossom implementation directive (as another value)', () => {
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
          blossomImplDirective(
            ThunkImplementationType.AsyncFunction,
            'AnotherValue',
          ),
        ],
      }),
    ).toBe(ThunkType.None);
  });
});

describe('parseFieldType', () => {
  const emptyIntermediateDict: IntermediateDictionary = {
    objects: {},
    inputs: {},
    enums: {},
  };

  it('must return KnownScalarTypes.String for GraphQL ID type', () => {
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

  it('must return KnownScalarTypes.String for GraphQL String type', () => {
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

  it('must return KnownScalarTypes.Number for GraphQL Int type', () => {
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

  it('must return KnownScalarTypes.Number for GraphQL Float type', () => {
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

  it('must return KnownScalarTypes.Boolean for GraphQL Boolean type', () => {
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

  it('must throw UnknownTypeError when a referenced type is not available in the intermediate dictionary', () => {
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

  it('must return correct referenced type when the definition is available in objects', () => {
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

  it('must return correct referenced type when the definition is available in enums', () => {
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

  it('must return correct referenced type when the definition is available in inputs', () => {
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

  it('must return throw UnknownTypeError when referenced type is in inputs', () => {
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

  it('must return throw UnknownTypeError when referenced type is in objects', () => {
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

describe('parseFieldDefinitionNode', () => {
  it('must return correct values when definiton has a NamedType kind', () => {
    const fieldTypeReturn = {
      kind: 'ReferencedType',
      name: 'TestType',
    };

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
      inputs: {},
      enums: {},
    };

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
});
