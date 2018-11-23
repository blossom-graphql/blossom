/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import merge from 'lodash.merge';

/**
 * Value descriptor of an enumeration.
 */
interface EnumValue {
  /**
   * Name and value.
   */
  name: string;
  /**
   * Description, in the schema.
   */
  description: string;
}

/**
 * Descriptor of a full enumeration in the schema.
 */
interface Enum {
  /**
   * Name of the enumeration.
   */
  name: string;
  /**
   * Description for the schema.
   */
  description: string;
  /**
   * List of possible value descriptors the enum
   * can take.
   */
  values: EnumValue[];
}

/**
 * A single argument descriptor of a RPC call.
 */
interface RPCArgument {
  /**
   * Programatical name to be displayed.
   */
  name: string;
  /**
   * Description, for comments and schema info, regarding
   * this parameter.
   */
  description: string;
  /**
   * Expected type for this parameter.
   */
  type: string;
}

/**
 * Base descriptor with the simplest elements.
 */
interface RPCDescriptionBase {
  /**
   * Name that this callback will have over the
   * root query.
   */
  name: string;
  /**
   * Full description of the operation in the comments.
   */
  description: string;
  /**
   * List of arguments this callback will receive. Will render
   * nothing if none is provided.
   */
  arguments?: RPCArgument[];
  /**
   * The type this callback will be returning.
   */
  type: string;
}

/**
 * The signature of a callback function.
 */
export type RPCCallback<U> = (args?: any, ctx?: any, ast?: any) => U;

/**
 * A descriptor of a RPC action, i.e. a query or a mutation.
 */
type RPCDescription = RPCDescriptionBase & {
  callback: RPCCallback<any>;
};

/**
 * Converts the RPC descriptor into a string that can be used on the whole
 * schema.
 *
 * @param rpcDescription Descriptor of the remote procedure call.
 */
function parseRPC(rpcDescription: RPCDescription): string {
  const convertedArguments = rpcDescription.arguments
    ? rpcDescription.arguments.map(
        argument =>
          `    """\n    ${argument.description}\n    """\n    ${
            argument.name
          }: ${argument.type}`,
      )
    : [];
  const argumentsText =
    convertedArguments.length > 0
      ? `(\n${convertedArguments.join('\n')}\n  )`
      : '';

  return `  """\n  ${rpcDescription.description}\n  """\n  ${
    rpcDescription.name
  }${argumentsText}: ${rpcDescription.type}`;
}

/**
 * An instance class of a GraphQL engine.
 */
class Instance {
  /**
   * The list of schemas saved in this instance.
   */
  schemas: string[] = [];

  /**
   * The list of registered enums saved in this instance.
   */
  enums: Enum[] = [];

  /**
   * The list of root queries stored on this instance.
   */
  rootQueries: RPCDescription[] = [];

  /**
   * The list of root mutations stored on this instance.
   */
  rootMutations: RPCDescription[] = [];

  /**
   * Take a schema chunk and adds it to the schema pool
   * to be built.
   *
   * @param schema The schema chunk to register.
   */
  registerSchema(schema: string) {
    this.schemas.push(schema);
  }

  /**
   * Adds an enumeration to the pool. Even though this can be made
   * through schemas, this way might be better for programatical
   * purposes.
   *
   * @param enumItem The descriptor of the enumeration
   */
  registerEnum(enumItem: Enum) {
    this.enums.push(enumItem);
  }

  /**
   * Registers a root query on the pool based on the descriptor.
   *
   * @param query The descriptor of the root query.
   */
  registerRootQuery(query: RPCDescription) {
    if (!!this.rootQueries.find(({ name }) => name === query.name)) {
      throw new Error(
        `Root Query with name ${query.name} already registered on instance.`,
      );
    }

    this.rootQueries.push(query);
  }

  /**
   * Registers a root query on the pool based on the descriptor.
   *
   * @param mutation The descriptor of the root mutation.
   */
  registerRootMutation(mutation: RPCDescription) {
    if (!!this.rootMutations.find(({ name }) => name === mutation.name)) {
      throw new Error(
        `Root Mutation with name ${
          mutation.name
        } already registered on instance.`,
      );
    }

    this.rootMutations.push(mutation);
  }

  /**
   * Collapses all the elements of the instance into a single
   * schema to be passed to a `buildSchema` or `makeExecutableSchema`
   * method of your favorite GraphQL server.
   */
  getRootSchema(): string {
    // Convert the enums to strings.
    const enums = this.enums.map(({ name, description, values }) => {
      const valuesStrings = values.map(
        ({ name, description }) => `  """\n  ${description}\n  """\n  ${name}`,
      );

      return `"""\n${description}\n"""\nenum ${name} {\n${valuesStrings.join(
        '\n',
      )}\n}`;
    });

    // Parse RPCs for root queries
    const rootQueries = this.rootQueries.map(rootQuery => parseRPC(rootQuery));

    const rootQueriesString =
      rootQueries.length > 0
        ? `type Query {\n${rootQueries.join('\n')}\n}`
        : '';

    // Parse RPCs for root mutations
    const rootMutations = this.rootMutations.map(rootMutation =>
      parseRPC(rootMutation),
    );

    const rootMutationsString =
      rootMutations.length > 0
        ? `type Mutation {\n${rootMutations.join('\n')}\n}`
        : '';

    const rootSchema = `schema {${rootQueriesString ? '\n  query: Query' : ``}${
      rootMutationsString ? '\n  mutation: Mutation' : ``
    }\n}`;

    // The array of all we are taking together.
    const chunks = [
      ...enums,
      ...this.schemas,
      rootQueriesString,
      rootMutationsString,
      rootSchema,
    ];

    return chunks.filter(chunk => !!chunk).join('\n\n');
  }

  /**
   * Takes root queries and mutations and convolves them on a single
   * object to be pased to the GraphQL engine.
   */
  getRootValue(): any {
    const mutations = this.rootMutations.map(({ name, callback }) => ({
      [name]: callback,
    }));
    const queries = this.rootQueries.map(({ name, callback }) => ({
      [name]: callback,
    }));

    return merge({}, ...mutations, ...queries);
  }
}

/**
 * Creates a new instance to start from scratch.
 */
export function createInstance() {
  const instance = new Instance();

  return {
    instance,
    RootQuery(descriptor: RPCDescriptionBase) {
      return function(base: RPCCallback<any>): RPCCallback<any> {
        instance.registerRootQuery({
          ...descriptor,
          callback: base,
        });

        return base;
      };
    },
    RootMutation(descriptor: RPCDescriptionBase) {
      return function(base: RPCCallback<any>): RPCCallback<any> {
        instance.registerRootMutation({
          ...descriptor,
          callback: base,
        });

        return base;
      };
    },
  };
}
