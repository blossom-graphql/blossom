/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { ObjectTypeDefinitionNode } from 'graphql';

import { BootDirectiveHandler } from './common';

const EDGE_COMMENT = (node: ObjectTypeDefinitionNode) =>
  `Edge type for ${node.name.value}. Automatically generated type because the object type attached the \`hasConnection\ flag.`;

const CONNECTION_COMMENT = (node: ObjectTypeDefinitionNode) =>
  `Connection type for ${node.name.value}. Automatically generated type because the object type attached the \`hasConnection\ flag.`;

export const hasConnectionDirectiveHandler: BootDirectiveHandler = (
  object,
  node,
) => {
  if (node.kind !== 'ObjectTypeDefinition') {
    return;
  }

  // Edge definition
  object.addDefinition({
    kind: 'ObjectTypeDefinition',
    name: {
      kind: 'Name',
      value: node.name.value + 'Edge',
      // loc: { ...node.name.loc },
    },
    description: {
      kind: 'StringValue',
      value: EDGE_COMMENT(node),
    },
    // loc: { ...node.loc },
    fields: [
      {
        kind: 'FieldDefinition',
        name: {
          kind: 'Name',
          value: 'node',
        },
        type: {
          kind: 'NonNullType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: node.name.value,
            },
          },
        },
      },
      {
        kind: 'FieldDefinition',
        name: {
          kind: 'Name',
          value: 'cursor',
        },
        type: {
          kind: 'NonNullType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'String',
            },
          },
        },
      },
    ],
  });

  // Connection definition
  object.addDefinition({
    kind: 'ObjectTypeDefinition',
    name: {
      kind: 'Name',
      value: node.name.value + 'Connection',
      // loc: { ...node.name.loc },
    },
    description: {
      kind: 'StringValue',
      value: CONNECTION_COMMENT(node),
    },
    // loc: { ...node.loc },
    fields: [
      {
        kind: 'FieldDefinition',
        name: {
          kind: 'Name',
          value: 'edges',
        },
        type: {
          kind: 'NonNullType',
          type: {
            kind: 'ListType',
            type: {
              kind: 'NamedType',
              name: {
                kind: 'Name',
                value: node.name.value + 'Edge',
              },
            },
          },
        },
      },
      {
        kind: 'FieldDefinition',
        name: {
          kind: 'Name',
          value: 'pageInfo',
        },
        type: {
          kind: 'NonNullType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'PageInfo',
            },
          },
        },
      },
    ],
  });
};
