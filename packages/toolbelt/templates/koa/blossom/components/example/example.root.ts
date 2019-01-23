import { GraphQLResolveInfo } from 'graphql';

import { RequestContext, resolveArray, BlossomRootQuery } from 'blossom/instance';
import { Example, ExampleQuery } from 'blossom/components/example/example.types';
import { exampleResolver } from 'blossom/components/example/example.resolvers';
import { exampleByName, ExampleData } from './example.sources';
import Maybe from 'graphql/tsutils/Maybe';

export const exampleRootQuery: ExampleQuery = async function exampleRootQuery(
  args: {
    names: ReadonlyArray<string>;
  },
  ctx: RequestContext,
  ast: GraphQLResolveInfo,
): Promise<ReadonlyArray<Maybe<Example>>> {
  const data = await ctx.loader(exampleByName).loadMany([...args.names]);

  return resolveArray<ExampleData, Example, typeof ctx>({
    data,
    ctx,
    using: exampleResolver,
    ast,
  });
};

// Registers the functon above as a root value in the Blossom instance.
BlossomRootQuery({ implements: 'example', using: exampleRootQuery });
