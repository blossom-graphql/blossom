/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// ! This file should be moved to a @blossom-gql/runtime packages since
// ! its components are going to be used by both the core and the toolbelt
// ! at least.
// !
// ! However, once GraphQL 14.1 is rolled out, maybe this is going to be
// ! deprecated depending on how re-usable are the extensions system in that
// ! library.

import {
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  NamedTypeNode,
  DirectiveNode,
  FieldDefinitionNode,
} from 'graphql';

export function mergeObjectTypeDefinition(
  definition: ObjectTypeDefinitionNode,
  extensions: ReadonlyArray<ObjectTypeExtensionNode>,
): ObjectTypeDefinitionNode {
  const interfaces: NamedTypeNode[] = definition.interfaces
    ? [...definition.interfaces]
    : [];
  const directives: DirectiveNode[] = definition.directives
    ? [...definition.directives]
    : [];
  const fields: FieldDefinitionNode[] = definition.fields
    ? [...definition.fields]
    : [];

  extensions.forEach(extension => {
    if (extension.name.value !== definition.name.value) return;
    if (extension.interfaces) interfaces.push(...extension.interfaces);
    if (extension.directives) directives.push(...extension.directives);
    if (extension.fields) fields.push(...extension.fields);
  });

  return { ...definition, interfaces, directives, fields };
}

type ExtendableTypeDefinition = ObjectTypeDefinitionNode;
type ExtendableTypeExtension = ObjectTypeExtensionNode;

const KIND_MAPPING = {
  ObjectTypeDefinition: 'ObjectTypeExtension',
};

export class ExtensionMap {
  types: Map<string, ExtendableTypeDefinition> = new Map();
  extensions: Map<string, ExtendableTypeExtension[]> = new Map();

  addDefinition(definition: ExtendableTypeDefinition) {
    const exists = this.types.has(definition.name.value);
    if (exists)
      throw new Error(
        `Definition ${definition.name.value} already registered.`,
      ); // TODO: Better error.

    this.types.set(definition.name.value, definition);
  }

  addExtension(extension: ExtendableTypeExtension) {
    const type = this.types.get(extension.name.value);
    const existingExtensionArray = this.extensions.get(extension.name.value);

    if (type && KIND_MAPPING[type.kind] !== extension.kind) {
      throw new Error(
        `Type is already defined as kind ${
          type.kind
        } but extension is of kind ${extension.kind}`,
      );
    }

    const newExtensionArray = existingExtensionArray
      ? [...existingExtensionArray, extension]
      : [extension];
    this.extensions.set(extension.name.value, newExtensionArray);
  }

  getFinalDefinition(name: string): ExtendableTypeDefinition {
    const type = this.types.get(name);
    const extensions = this.extensions.get(name);

    if (!type) {
      throw new ReferenceError(`Definition for ${name} not registered`);
    }

    if (!extensions || extensions.length === 0) return type;

    switch (type.kind) {
      case 'ObjectTypeDefinition':
        return mergeObjectTypeDefinition(
          type,
          extensions as ObjectTypeExtensionNode[],
        );
    }
  }
}
