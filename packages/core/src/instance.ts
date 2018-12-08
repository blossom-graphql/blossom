/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import merge from 'lodash.merge';

import {
  BlossomError,
  BlossomEmptyHandlerError,
  BlossomRootValueAlreadyInUse,
  BlossomErrorHandlerDict,
  ErrorHandlingFunction,
} from './errors';
import {
  IEnum,
  IRPCDescriptionBase,
  renderEnumToSchema,
  renderRPCDescriptionToSchema,
  renderSchema,
  RPCDescription,
  RPCCallback,
} from './schema';

/**
 * Prototype of a Blossom instance.
 */
export interface IBlossomInstance {
  registerSchema: (schema: string) => void;
  registerEnum: (enumItem: IEnum) => void;
  registerRootQuery: (query: RPCDescription) => void;
  registerRootMutation: (mutation: RPCDescription) => void;
  registerErrorHandler: (
    errorClass: BlossomError,
    handlingFunction?: ErrorHandlingFunction,
  ) => void;
  getRootSchema: () => RootSchema;
  getRootValue: () => any;
}

/**
 * Type for storing root schema state.
 */
export type RootSchema = {
  schemaString: string;
};

/**
 * An instance class of a GraphQL engine.
 *
 * TODO: Add memoization to the common parameters + a reload() function.
 * TODO: Convert rootQueries and rootMutation to dict in order to get O(1) R/W.
 */
export class BlossomInstance implements IBlossomInstance {
  /**
   * The list of schemas saved in this instance.
   */
  schemaStrings: string[] = [];

  /**
   * The list of registered enums saved in this instance.
   */
  enums: IEnum[] = [];

  /**
   * The list of root queries stored on this instance.
   */
  rootQueries: RPCDescription[] = [];

  /**
   * The list of root mutations stored on this instance.
   */
  rootMutations: RPCDescription[] = [];

  /**
   * Mapping for introducing error handlers in the instance.
   */
  errorHandlers: BlossomErrorHandlerDict = new Map<
    Function,
    ErrorHandlingFunction
  >();

  /**
   * Cache of the computed values of the instance for memoization.
   */
  memoValues: { rootSchema?: RootSchema; rootValue?: any } = {
    rootSchema: undefined,
    rootValue: undefined,
  };

  /**
   * Take a schema chunk and adds it to the schema pool
   * to be built.
   *
   * @param schema The schema chunk to register.
   */
  registerSchema(schema: string) {
    this.schemaStrings.push(schema);
  }

  /**
   * Adds an enumeration to the pool. Even though this can be made
   * through schemas, this way might be better for programatical
   * purposes.
   *
   * @param enumItem The descriptor of the enumeration
   */
  registerEnum(enumItem: IEnum) {
    this.enums.push(enumItem);
  }

  /**
   * Registers a root query on the pool based on the descriptor.
   *
   * @param query The descriptor of the root query.
   */
  registerRootQuery(query: RPCDescription) {
    if (this.hasRPC(query.name)) {
      throw new BlossomRootValueAlreadyInUse(
        `Root Query / Mutation with name ${
          query.name
        } already registered on instance.`,
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
    if (this.hasRPC(mutation.name)) {
      throw new BlossomRootValueAlreadyInUse(
        `Root Query / Mutation with name ${
          mutation.name
        } already registered on instance.`,
      );
    }

    this.rootMutations.push(mutation);
  }

  /**
   * Registers an error handler for this Blossom instance.
   *
   * @param errorClass Constructor of the error class.
   *
   * @param handlingFunction Function that handles the error. If no function is
   * provided, will try to retrieve handler from the static handler() method
   * of the constructor.
   */
  registerErrorHandler(
    errorClass: BlossomError,
    handlingFunction?: ErrorHandlingFunction,
  ) {
    if (this.errorHandlers.has(errorClass)) {
      throw new BlossomEmptyHandlerError(
        `${errorClass.name} error handler already registered`,
      );
    }

    if (handlingFunction) {
      this.errorHandlers.set(errorClass, handlingFunction);
    } else if (errorClass.handler) {
      this.errorHandlers.set(errorClass, errorClass.handler);
    } else {
      throw new BlossomEmptyHandlerError(
        `If handlingFunction parameter is empty, errorClass.handler must be implemented`,
      );
    }
  }

  /**
   * Collapses all the elements of the instance into a single
   * schema to be passed to a `buildSchema` or `makeExecutableSchema`
   * method of your favorite GraphQL server.
   */
  getRootSchema({ force = false }: { force?: boolean } = {}): RootSchema {
    // Try to retrieve memoization first.
    if (this.memoValues.rootSchema && !force) return this.memoValues.rootSchema;

    // Convert the enums to strings.
    const enumsStrings = this.enums.map(enumDescription =>
      renderEnumToSchema(enumDescription),
    );

    // Convert RPC Descriptors to string
    const rootQueriesStrings = this.rootQueries.map(rootQuery =>
      renderRPCDescriptionToSchema(rootQuery),
    );
    const rootMutationsStrings = this.rootMutations.map(rootMutation =>
      renderRPCDescriptionToSchema(rootMutation),
    );

    // Stitch them together, memoize and return
    const schemaString = renderSchema(
      enumsStrings,
      this.schemaStrings,
      rootQueriesStrings,
      rootMutationsStrings,
    );
    this.memoValues.rootSchema = {
      schemaString,
    };

    return this.memoValues.rootSchema;
  }

  /**
   * Takes root queries and mutations and convolves them on a single
   * object to be pased to the GraphQL engine.
   */
  getRootValue({ force = false }: { force?: boolean } = {}): any {
    if (this.memoValues.rootValue && !force) return this.memoValues.rootValue;

    const mutations = this.rootMutations.map(({ name, callback }) => ({
      [name]: callback,
    }));
    const queries = this.rootQueries.map(({ name, callback }) => ({
      [name]: callback,
    }));

    // Create the object in the memo and return it
    this.memoValues.rootValue = merge({}, ...mutations, ...queries);

    return this.memoValues.rootValue;
  }

  /**
   * Does this instance already have a RPC (query or mutation) with a given
   * name?
   *
   * @param name Name of the RPC to search for.
   */
  hasRPC(name: string): boolean {
    return (
      this.rootQueries.findIndex(query => name === query.name) > -1 ||
      this.rootMutations.findIndex(mutation => name === mutation.name) > -1
    );
  }

  /**
   * Returns rootValue. If not computed yet, will be computed for you.
   */
  get rootValue(): any {
    return this.getRootValue({ force: false });
  }

  /**
   * Returns rootSchemaString. If not computed yet, will be computed for you.
   */
  get rootSchemaString(): string {
    return this.getRootSchema({ force: false }).schemaString;
  }
}

/**
 * A function that receives a RPCCallback, proxies it to the Blossom instance
 * and returns the exact same function, which in turn can be exported.
 *
 * These functions are meant to be used as top level decorators in the future
 * if TC39 decides to bring support for them.
 */
type AccumulatorFunction = <R>(base: RPCCallback<R>) => RPCCallback<R>;

/**
 * Options for the Blossom Error accumulator function.
 */
type BlossomErrorInput = {
  /**
   * Error handling function. If empty, the handler must be provided as a static
   * handler method in the error class.
   */
  handler?: ErrorHandlingFunction;
};

/**
 * A proxy to the Blossom instance in order to functionally access all of the
 * user-facing concerns.
 */
interface IBlossomInstanceProxy {
  /**
   * Accumulator function for registering a root query.
   */
  BlossomRootQuery: (descriptor: IRPCDescriptionBase) => AccumulatorFunction;
  /**
   * Accumulator function for registering a root mutation.
   */
  BlossomRootMutation: (descriptor: IRPCDescriptionBase) => AccumulatorFunction;
  /**
   * Accumulator for adding custom blossom errors.
   */
  BlossomError: (
    opts?: BlossomErrorInput,
  ) => (constructor: BlossomError) => BlossomError;
}

/**
 * Receives a Blossom instance and returns a group of decorators that can be
 * used to register multiple kinds of components.
 */
export function createBlossomDecorators(
  blossomInstance: IBlossomInstance,
): IBlossomInstanceProxy {
  return {
    BlossomRootQuery(descriptor: IRPCDescriptionBase) {
      return function<R>(base: RPCCallback<R>): RPCCallback<R> {
        blossomInstance.registerRootQuery({
          ...descriptor,
          callback: base,
        });

        return base;
      };
    },
    BlossomRootMutation(descriptor: IRPCDescriptionBase) {
      return function<R>(base: RPCCallback<R>): RPCCallback<R> {
        blossomInstance.registerRootMutation({
          ...descriptor,
          callback: base,
        });

        return base;
      };
    },
    BlossomError(opts: BlossomErrorInput = {}) {
      return function(errorClass: BlossomError) {
        const { handler } = opts;
        blossomInstance.registerErrorHandler(errorClass, handler);

        return errorClass;
      };
    },
  };
}
