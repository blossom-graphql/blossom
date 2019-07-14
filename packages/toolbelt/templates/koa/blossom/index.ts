import { blossom } from '@blossom-gql/core';
import { DocumentNode } from 'graphql';
import koaGraphqlPlayground from 'graphql-playground-middleware-koa';

import router from 'lib/server/router';

import { instance } from './instance';

// We'll add the playground as a route only on non-production environments
if (process.env.NODE_ENV !== 'production') {
  router.get('/graphql', koaGraphqlPlayground({ endpoint: 'graphql' }));
}

// Unlike other frameworks, we **don't** believe in voodoo. These statements
// below import all your code under certain patterns, so you can tune them
// in the future however you find best.

// GraphQL SDL files must automatically added as documents
const schemas = require.context('./components', true, /\.(gql|graphql)$/i);
schemas.keys().forEach(key => {
  const imported = schemas(key);
  const document: DocumentNode = imported.default;

  instance.addDocument(document);
});

// Blossom root files register files in the instance
const blossomRootFiles = require.context('./components', true, /\.root\.ts$/i);
blossomRootFiles.keys().forEach(blossomRootFiles);

// Create resolve instance and add a route
const blossomResolve = blossom(instance);
router.post('/graphql', async (ctx, next) => {
  // For some unknown reason koa.Request is failing to capture the extensions
  // given by @types/koa-bodyparser. Since this is a hot path and we have
  // assurances about how this is going to behave, we can just remove the
  // type safety check here by assuming that ctx.request is any for this
  // assignment.
  const { operationName, query, variables } = (ctx.request as any).body;

  const result = await blossomResolve({ operationName, query, variables }, ctx);

  ctx.response.status = 200;
  ctx.response.body = result;

  await next();
});
