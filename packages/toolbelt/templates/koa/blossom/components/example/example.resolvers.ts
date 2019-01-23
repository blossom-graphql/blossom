import { Resolver } from '@blossom-gql/core';

import { RequestContext } from 'blossom/instance';
import { Example } from 'blossom/components/example/example.types';
import { ExampleData } from './example.sources';

export const exampleResolver: Resolver<
  ExampleData,
  Example,
  RequestContext
> = function exampleResolver(attributes) {
  return {
    // Must always be present.
    __typename: 'Example',
    // TODO: Remove this and map attributes to the properties of the output type.
    ...attributes,
  };
};
