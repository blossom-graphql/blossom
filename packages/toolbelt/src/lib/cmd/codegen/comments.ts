/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { comment } from './common';

export const ROOT_BLOCK_COMMENT = comment`
A root function is where the graph starts! Here you're supposed to retrieve
data from a data source (loader or connection), do whatever is necessary with
provided inputs and pass it down to a resolver, just like the controller of a
MVC pattern.

You can call a loader here by doing ctx.loader(/* Name of batch fn */) and
a resolver by calling resolve({ data, ctx, using: /* Name of the resolver */ }).

TODO: Implement me! i.e. Find what \`data\` needs to be here in order for
this to properly resolve.

`;

export const ROOT_REGISTRATION_COMMENT = comment`
Registers the function above as a root value in the Blossom instance.
`;

export const SOURCE_COMMENT = comment`
Here you are receiving an array of scalars used as IDs. You're expected to
return an array where the position "n" of the array contains the entity
associated to the ID of the position "n" of the array, otherwise null.

[4, 9, 5] --> [<- Entity(id: 4) ->, <- Entity(id: 9) ->, <- Entity(id: 5) ->]

You're supposed to retrieve the entities from your data source in a single
operation. THIS IS THE ONLY WAY TO AVOID A n+1 QUERY. Examples:

- If your data comes from Sequelize or Mongo, use a [Op.in] / $in operator.

- If you're hitting an API, try to find an endpoint to retrieve multiple
  entities by ID at once.

- If you're hitting an Elastic server, try to use _mget.

Your data source will probably give you the results unordered or some of them
might be missing. Use the \`deliver\` and \`deliverGroup\` functions from the
\`@blossom-gql/core\` module for automatically re-sorting them for you.

You can also return an array on this position if you need to return multiple
results / entities by ID.

If you need information about the request context, is available as a second
argument for this function. However, BEWARE THAT LOADERS ARE NOT SUPPOSED TO
DEPEND ON CONTEXT INFORMATION FOR THE PULLING LOGIC.

See documentation on Loaders for more information.

TODO:

- Replace unknown on the return type of the function with the type you're
  expected to return from your data source.

- Implement the function contents.

`;

export const RESOLVER_TYPENAME_COMMENT = comment`
Must always be present.
`;

export const RESOLVER_COMMENTS = comment`
A resolver is a function that maps the elements from the data source to
the elements of the type definition in the GraphQL SDL. This way, you have
freedom not only to choose what properties from the data source are
exposed or not, but also to create computed properties and call nested
elements by calling other loaders and resolvers.

You can also get access to the request context by accepting a second
argument in the resolver. This can be useful for calling other resolvers
or doing things based on user permissions.

Finally, you can get GraphQL.JS's GraphQLResolveInfo (i.e. the AST of the)
request, by accepting a third argument. This can be used for further
optimizations.

TODO:
- Change unknown in the signature.
- Implement the function contents.
`;

export const RESOLVER_OTHER_PROPS_COMMENT = comment`
TODO: Remove this and map attributes to the properties of the output type.
`;

export const CONNECTION_RESOLVER_COMMENT = comment`
This is an automatically generated resolver by using the base resolver for the
type. It was automatically added because you added a @hasConnection directive
to your type in the schema declaration file.

Whenever resolving a connection, you should be using this resolver in your
\`resolve\` function instead.

TODO: Define the value of \`unknown\`. It should match the one on your base
resolver.
`;

export const CONNECTION_TYPE_COMMENT = (name: string) => comment`
This is the connection type that must be returned on a field or operation that
resolves to a ${name}Connection.
`;
