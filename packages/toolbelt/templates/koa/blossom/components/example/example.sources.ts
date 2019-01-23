import { BatchFunction, Maybe, deliver } from '@blossom-gql/core';

import { RequestContext } from 'blossom/instance';

export type ExampleData = {
  name: string;
  message: string;
};

export const exampleByName: BatchFunction<
  string,
  Maybe<ExampleData>,
  RequestContext
> = async function exampleByName(names) {
  return names.map(name => ({ name, message: `Hello, ${name}!` }));
};
