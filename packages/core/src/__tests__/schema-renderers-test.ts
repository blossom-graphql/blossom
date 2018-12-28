/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  renderEnumToSchema,
  renderRPCDescriptionToSchema,
  renderSchema,
} from '../schema';

describe(renderRPCDescriptionToSchema, () => {
  test('should return correct string when function has no description', () => {
    expect(
      renderRPCDescriptionToSchema({
        name: 'testFunction',
        type: 'Test',
        callback: () => null,
      }),
    ).toEqual(`  """
  
  """
  testFunction: Test`);
  });

  test('should return correct string when function has no arguments', () => {
    expect(
      renderRPCDescriptionToSchema({
        name: 'testFunction',
        type: 'Test',
        description: 'Test description',
        callback: () => null,
      }),
    ).toEqual(`  """
  Test description
  """
  testFunction: Test`);
  });

  test('should return correct string when function has empty arguments lists', () => {
    expect(
      renderRPCDescriptionToSchema({
        name: 'testFunction',
        type: 'Test',
        description: 'Test description',
        arguments: [],
        callback: () => null,
      }),
    ).toEqual(`  """
  Test description
  """
  testFunction: Test`);
  });

  test('should return correct string when function has argument with no description', () => {
    expect(
      renderRPCDescriptionToSchema({
        name: 'testFunction',
        type: 'Test',
        description: 'Test description',
        arguments: [{ name: 'testArgument1', type: 'Int' }],
        callback: () => null,
      }),
    ).toEqual(`  """
  Test description
  """
  testFunction(
    """
    
    """
    testArgument1: Int
  ): Test`);
  });

  test('should return correct string when function has multiple arguments', () => {
    expect(
      renderRPCDescriptionToSchema({
        name: 'testFunction',
        type: 'Test',
        description: 'Test description',
        arguments: [
          { name: 'testArgument1', type: 'Int' },
          {
            name: 'testArgument2',
            description: 'Test description',
            type: 'String!',
          },
        ],
        callback: () => null,
      }),
    ).toEqual(`  """
  Test description
  """
  testFunction(
    """
    
    """
    testArgument1: Int
    """
    Test description
    """
    testArgument2: String!
  ): Test`);
  });
});

describe(renderEnumToSchema, () => {
  test('should return correct string when enum has no description', () => {
    expect(
      renderEnumToSchema({
        name: 'TestEnum',
        values: [{ name: 'foo', description: 'Test description' }],
      }),
    ).toEqual(`"""

"""
enum TestEnum {
  """
  Test description
  """
  foo
}`);
  });

  test('should return correct string when enum has no values (empty array)', () => {
    expect(
      renderEnumToSchema({
        name: 'TestEnum',
        description: 'Test description',
        values: [],
      }),
    ).toEqual(`"""
Test description
"""
enum TestEnum {

}`);
  });

  test('should return correct string when enum has value with no description', () => {
    expect(
      renderEnumToSchema({
        name: 'TestEnum',
        description: 'Test description',
        values: [{ name: 'foo' }],
      }),
    ).toEqual(`"""
Test description
"""
enum TestEnum {
  """
  
  """
  foo
}`);
  });

  test('should return correct string when enum has multiple values', () => {
    expect(
      renderEnumToSchema({
        name: 'TestEnum',
        description: 'Test description',
        values: [
          { name: 'foo', description: 'Test description (foo)' },
          { name: 'bar', description: 'Test description (bar)' },
        ],
      }),
    ).toEqual(`"""
Test description
"""
enum TestEnum {
  """
  Test description (foo)
  """
  foo
  """
  Test description (bar)
  """
  bar
}`);
  });
});

describe(renderSchema, () => {
  const TEST_TYPE = 'type Test { foo: String }';
  const TEST_ENUM = 'enum TestEnum { foo, bar }';
  const TEST_QUERY_RPC = '  testQuery: Test';
  const TEST_MUTATION_RPC = '  testMutation: Test';

  test('should render an empty string when nothing is passed', () => {
    expect(renderSchema([], [], [], [])).toEqual('');
  });

  test('should return no schema {} statement if no root queries or mutations are defined', () => {
    const renderedSchema = renderSchema([], [TEST_TYPE], [], []);

    expect(renderedSchema.indexOf('schema {')).toBe(-1);
  });

  test('should return rendered enum values', () => {
    const renderedSchema = renderSchema([TEST_ENUM], [], [], []);

    expect(renderedSchema.indexOf(TEST_ENUM)).toBeGreaterThan(-1);
  });

  test('should return rendered type values', () => {
    const renderedSchema = renderSchema([], [TEST_TYPE], [], []);

    expect(renderedSchema.indexOf(TEST_TYPE)).toBeGreaterThan(-1);
  });

  test('should correctly consider inclusion of query RPC strings', () => {
    // Basically, the type Query {} must be defined and the Query RPC String
    // must be inside of it.
    const SEARCH_REGEXP = new RegExp(
      `type Query {[.\n]*${TEST_QUERY_RPC}[.\n]*}`,
      'g',
    );

    const renderedSchema = renderSchema([], [], [TEST_QUERY_RPC], []);

    expect(SEARCH_REGEXP.test(renderedSchema)).toBe(true);
  });

  test('should correctly consider inclusion of mutation RPC strings', () => {
    // Basically, the type Query {} must be defined and the Query RPC String
    // must be inside of it.
    const SEARCH_REGEXP = new RegExp(
      `type Mutation {[.\n]*${TEST_MUTATION_RPC}[.\n]*}`,
      'g',
    );

    const renderedSchema = renderSchema([], [], [], [TEST_MUTATION_RPC]);

    expect(SEARCH_REGEXP.test(renderedSchema)).toBe(true);
  });

  test('should only return `query: Query` in schema statement when only query strings are sent', () => {
    const EXPECTED_SCHEMA_STATEMENT = `schema {
  query: Query
}`;

    const renderedSchema = renderSchema([], [], [TEST_QUERY_RPC], []);

    expect(renderedSchema.indexOf(EXPECTED_SCHEMA_STATEMENT)).toBeGreaterThan(
      -1,
    );
  });

  test('should only return `mutation: Mutation` in schema statement when only mutation strings are sent', () => {
    const EXPECTED_SCHEMA_STATEMENT = `schema {
  mutation: Mutation
}`;

    const renderedSchema = renderSchema([], [], [], [TEST_MUTATION_RPC]);

    expect(renderedSchema.indexOf(EXPECTED_SCHEMA_STATEMENT)).toBeGreaterThan(
      -1,
    );
  });

  test('should include complete schema statement when both query and mutation strings are passed', () => {
    const EXPECTED_SCHEMA_STATEMENT = `schema {
  query: Query
  mutation: Mutation
}`;

    const renderedSchema = renderSchema(
      [],
      [],
      [TEST_QUERY_RPC],
      [TEST_MUTATION_RPC],
    );

    expect(renderedSchema.indexOf(EXPECTED_SCHEMA_STATEMENT)).toBeGreaterThan(
      -1,
    );
  });

  test('should include every type of argument passed by in the global string, with correct spacing', () => {
    const renderedSchema = renderSchema(
      [TEST_ENUM],
      [TEST_TYPE],
      [TEST_QUERY_RPC],
      [TEST_MUTATION_RPC],
    );

    expect(renderedSchema).toEqual(`${TEST_ENUM}

${TEST_TYPE}

type Query {
${TEST_QUERY_RPC}
}

type Mutation {
${TEST_MUTATION_RPC}
}

schema {
  query: Query
  mutation: Mutation
}`);
  });
});
