/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  createConnectionResolver,
  createResolver,
  resolve,
  ConnectionDecorator,
} from '../resolver';

type TestResolverInput = { message: string };
type TestResolverOutput = { message: string; length: number };

const testResolver = jest.fn(({ message }: TestResolverInput) => {
  return {
    message,
    length: message.length,
  };
});

const TYPENAME = 'Test';

describe('createResolver', () => {
  beforeEach(() => jest.clearAllMocks());

  it('must have called the resolver with correct arguments', () => {
    const resolverInput = { message: 'foo' };
    const builtResolver = createResolver(TYPENAME, testResolver);
    const testContext = { foo: 'bar' };
    builtResolver(resolverInput, testContext);

    expect(testResolver).toHaveBeenCalledWith(resolverInput, testContext);
  });

  it('must include defined typename on output', () => {
    const builtResolver = createResolver(TYPENAME, testResolver);
    const resolvedValue = builtResolver({ message: 'foo' });

    // TypeScript Guard
    if (!resolvedValue) {
      throw new Error('resolvedValue is empty in this test');
    }

    expect(resolvedValue.__typename).toBe(TYPENAME);
  });

  it('must include properties that the original function returns', () => {
    const resolverInput = { message: 'foo' };

    const preResolverOutput = testResolver(resolverInput);
    const builtResolver = createResolver(TYPENAME, testResolver);
    const resolvedValue = builtResolver(resolverInput);

    // TypeScript Guard
    if (!resolvedValue) {
      throw new Error('resolvedValue is empty in this test');
    }

    expect(resolvedValue).toEqual({
      __typename: TYPENAME,
      ...preResolverOutput,
    });
  });
});

describe('createConnectionResolver', () => {
  beforeEach(() => jest.clearAllMocks());

  // We are testing reference equality. If in the future more than node must be
  // added, then one cursorRef must be created per node.
  const cursorRef = () => 'foo';

  const connectionAttributes = {
    edges: jest.fn(async function edges() {
      return [
        {
          node() {
            return { message: 'foo' };
          },
          cursor: cursorRef,
        },
      ];
    }),
    pageInfo: {
      async count() {
        return 1;
      },
      async hasPreviousPage() {
        return false;
      },
      async hasNextPage() {
        return false;
      },
    },
  };

  it('must include correct typename after calling resolver', () => {
    const builtConnectionResolver = createConnectionResolver(
      TYPENAME,
      testResolver,
    );

    // Resolve the connection
    const resolvedConnection = builtConnectionResolver(connectionAttributes);

    expect(resolvedConnection.__typename).toBe(`${TYPENAME}Connection`);
  });

  it('must directly wire pageInfo from the attributes property', () => {
    const builtConnectionResolver = createConnectionResolver(
      TYPENAME,
      testResolver,
    );

    // Resolve the connection
    const resolvedConnection = builtConnectionResolver(connectionAttributes);

    expect(resolvedConnection.pageInfo).toBe(connectionAttributes.pageInfo);
  });

  it(
    'must not call edges() on the attributes object if the result ' +
      'edges() property has not been called',
    () => {
      const builtConnectionResolver = createConnectionResolver(
        TYPENAME,
        testResolver,
      );

      // Resolve the connection
      builtConnectionResolver(connectionAttributes);

      // Nothing should have happened
      expect(connectionAttributes.edges).not.toHaveBeenCalled();
    },
  );

  it(
    'must call edges() on the attributes object with the ' +
      'correct arguments when the result edges() property is called called',
    async () => {
      expect.assertions(1);

      const builtConnectionResolver = createConnectionResolver(
        TYPENAME,
        testResolver,
      );
      const resolverContext = { foo: 'bar' };

      // Resolve the connection
      const resolvedConnection = builtConnectionResolver(
        connectionAttributes,
        resolverContext,
      );
      await resolvedConnection.edges();

      // Nothing should have happened
      expect(connectionAttributes.edges).toHaveBeenCalledWith(
        null,
        resolverContext,
      );
    },
  );

  it(
    'must not call resolver function if edges().node() function ' +
      'has not been invoked',
    async () => {
      expect.assertions(1);

      const builtConnectionResolver = createConnectionResolver(
        TYPENAME,
        testResolver,
      );

      // Resolve the connection
      const resolvedConnection = builtConnectionResolver(connectionAttributes);
      await resolvedConnection.edges();

      expect(testResolver).not.toHaveBeenCalled();
    },
  );

  it(
    'must call resolver function with correct arguments ' +
      'if edges().node() function is invoked',
    async () => {
      const builtConnectionResolver = createConnectionResolver(
        TYPENAME,
        testResolver,
      );
      const connectionAttributesEdges = await connectionAttributes.edges();
      const resolverContext = { foo: 'bar' };

      expect.assertions(1 + connectionAttributesEdges.length);

      // Resolve the connection
      const resolvedConnection = builtConnectionResolver(
        connectionAttributes,
        resolverContext,
      );
      const resolvedEdges = await resolvedConnection.edges();

      // Call all the nodes (i.e. 1), but we're leaving the generic expression
      // here in case the text changes
      await Promise.all(resolvedEdges.map(edge => edge.node()));

      // Resolver function must have been called as many times as edges there are
      expect(testResolver).toHaveBeenCalledTimes(resolvedEdges.length);

      // The resolver must been called with the correct arguments for each of the nodes
      // We don't care about the order.
      connectionAttributesEdges.forEach((connectionAttribute: any) =>
        expect(testResolver).toHaveBeenCalledWith(
          connectionAttribute.node(),
          resolverContext,
        ),
      );
    },
  );

  it(
    'must properly wire edges().cursor() from the ' + 'connections function',
    async () => {
      const builtConnectionResolver = createConnectionResolver(
        TYPENAME,
        testResolver,
      );
      const connectionAttributesEdges = await connectionAttributes.edges();

      expect.assertions(connectionAttributesEdges.length);

      // Resolve the connection
      const resolvedConnection = builtConnectionResolver(connectionAttributes);
      const resolvedEdges = await resolvedConnection.edges();

      // The resolver must been called with the correct arguments for each of the nodes
      // We don't care about the order.
      resolvedEdges.forEach(resolvedEdge => {
        // Because of this, this test is going to be O(n^2). Obviously we can
        // make it O(n) but using a dict. But n = 1 at this time.
        //
        // Does it really worth it overly-complicating this test in order to
        // decrease this test running time for bigger n? Not a this moment.
        const matchingConnectionEdge = connectionAttributesEdges.find(
          ({ node }: { node: () => { message: string } }) =>
            resolvedEdge.node().message === node().message,
        );

        if (!matchingConnectionEdge) {
          throw new Error(
            `Matching connection edge not found for resolved edge ${resolvedEdge}`,
          );
        }

        expect(resolvedEdge.cursor).toBe(matchingConnectionEdge.cursor);
      });
    },
  );
});

describe('resolve', () => {
  beforeEach(() => jest.clearAllMocks());

  // Need to create the mock resolver here, inside the closure, in order to
  // match the type signature of an actual created resolver.
  //
  // We could do this with createResolver(), yes, but this is a unit test, so
  // we shouldn't be involving that function here. Otherwise, this would become
  // an integration test.
  const testResolver = jest.fn(function testResolver({
    message,
  }: TestResolverInput): TestResolverOutput & ConnectionDecorator {
    return {
      __typename: 'Test',
      message,
      length: message.length,
    };
  });
  const resolverContext = { foo: 'bar' };

  it('must return null if attributes are not passed', () => {
    expect(
      resolve<TestResolverInput, TestResolverOutput>({
        attributes: null,
        using: testResolver,
        context: resolverContext,
      }),
    ).toBeNull();
  });

  it(
    'must call resolver as many times as elements are ' +
      'passed on an array as attributes',
    () => {
      const TEST_ARRAY = [{ message: 'foo' }, { message: 'bar' }];

      resolve<TestResolverInput, TestResolverOutput>({
        attributes: TEST_ARRAY,
        using: testResolver,
        context: resolverContext,
      });

      TEST_ARRAY.forEach(element => {
        expect(testResolver).toHaveBeenCalledWith(element, resolverContext);
      });
    },
  );

  it('must return resolved values in the correct order', () => {
    // Might look like an integration test, but it is not. testResolver is
    // mocked on this describe() block.

    const TEST_ARRAY = [{ message: 'foo' }, { message: 'bar' }];

    const resolvedValues = resolve<TestResolverInput, TestResolverOutput>({
      attributes: TEST_ARRAY,
      using: testResolver,
      context: resolverContext,
    }) as TestResolverOutput[];

    TEST_ARRAY.forEach((element, i) => {
      expect(resolvedValues[i]).toEqual(testResolver(element, resolverContext));
    });
  });

  it(
    'must call resolver once, with correct arguments, when ' +
      'a single element is passed',
    () => {
      const TEST_ATTRIBUTES = { message: 'foo' };

      resolve<TestResolverInput, TestResolverOutput>({
        attributes: TEST_ATTRIBUTES,
        using: testResolver,
        context: resolverContext,
      });

      expect(testResolver).toHaveBeenCalledTimes(1);
      expect(testResolver).toHaveBeenCalledWith(
        TEST_ATTRIBUTES,
        resolverContext,
      );
    },
  );

  it('must return correct resolved value', () => {
    // Might look like an integration test, but it is not. testResolver is
    // mocked on this describe() block.

    const TEST_ATTRIBUTES = { message: 'foo' };

    const resolvedValue = resolve<TestResolverInput, TestResolverOutput>({
      attributes: TEST_ATTRIBUTES,
      using: testResolver,
      context: resolverContext,
    }) as TestResolverOutput;

    expect(resolvedValue).toEqual(
      testResolver(TEST_ATTRIBUTES, resolverContext),
    );
  });
});
