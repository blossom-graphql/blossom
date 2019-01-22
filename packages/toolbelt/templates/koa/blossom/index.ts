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
const schemas = require.context('./components', true, /.(gql|graphql)$/i);
schemas.keys().forEach(key => {
  const imported = schemas(key);
  const document: DocumentNode = imported.default;

  instance.addDocument(document);
});

// Create resolve instance and add a route
const blossomResolve = blossom(instance);
router.post('/graphql', async (ctx, next) => {
  const { operationName, query, variables } = ctx.request.body;

  const result = await blossomResolve({ operationName, query, variables }, ctx);

  ctx.response.status = 200;
  ctx.response.body = result;

  await next();
});
