import {
  BlossomContext,
  BlossomInstance,
  createBlossomDecorators,
} from '@blossom-gql/core';
import { Context } from 'koa';

// Creates a new BlossomInstance. You can have multiple instances, with their
// associated schemas and root queries / mutations on a single project, even
// though is discouraged.
//
// You can also integrate Blossom into an existing project just by importing the
// core and creating a new instance.
const instance = new BlossomInstance();

// Create elements that are based on the instance.
const {
  BlossomRootQuery, // Registers a Root Query
  BlossomRootMutation, // Registers a Root Mutation
  BlossomError, // Subclass these in order to handle errors
  resolve, // Your resolver for this instance
  resolveArray, // Your resolver for arrays in this instance
  createConnectionResolver, // Creates resolvers for connections
} = createBlossomDecorators(instance);

// Create a context to be used across the entire GraphQL request
type RequestContext = BlossomContext<Context>;

// Export all the newly created elements in order to use them across the app
export {
  BlossomRootQuery,
  BlossomRootMutation,
  BlossomError,
  instance,
  RequestContext,
  resolve,
  resolveArray,
  createConnectionResolver,
};
