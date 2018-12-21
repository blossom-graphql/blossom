/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  thunkTypeFromDirectives,
  ThunkType,
  ThunkImplementationType,
  BLOSSOM_IMPLEMENTATION_DIRECTIVE,
  BLOSSOM_IMPLEMENTATION_ARGUMENT_NAME,
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
    argumentType: 'StringValue' | 'EnumValue',
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
});

describe('parseDocumentObjectType', () => {});
