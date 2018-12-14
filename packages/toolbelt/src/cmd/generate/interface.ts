import { readFileSync } from 'fs';
import { join } from 'path';

import {
  parse,
  DefinitionNode,
  DocumentNode,
  ObjectTypeDefinitionNode,
  SchemaDefinitionNode,
  DirectiveNode,
} from 'graphql';

// const knownMappings = {
//   String: 'string',
//   Int: 'number',
//   Float: 'number',
//   Boolean: 'boolean',
//   ID: 'id',
// };

function getDocument(): DocumentNode | undefined {
  try {
    return parse(readFileSync(join(__dirname, 'test.gql')).toString('utf-8'));
  } catch (SyntaxError) {
    console.error('Was an error with the syntax.');
    return undefined;
  }
}

const document = getDocument();

if (!document) {
  throw new Error('No valid document. Quitting.');
}

type Dict = {
  objects: { [key: string]: ObjectTypeDefinitionNode };
  inputs: { [key: string]: DefinitionNode };
  schema?: SchemaDefinitionNode;
  queryType?: string;
  mutationType?: string;
};

const dict: Dict = {
  objects: {},
  inputs: {},
  schema: undefined,
  queryType: '',
  mutationType: '',
};

for (let definition of document.definitions) {
  switch (definition.kind) {
    case 'ObjectTypeDefinition':
      dict.objects[definition.name.value] = definition;
      break;
    case 'InputObjectTypeDefinition':
      dict.inputs[definition.name.value] = definition;
      break;
    case 'SchemaDefinition':
      dict.schema = definition;
      break;
  }
}

if (dict.schema) {
  for (let operation of dict.schema.operationTypes) {
    if (['query', 'mutation'].includes(operation.operation)) {
      if (!dict.objects.hasOwnProperty(operation.type.name.value)) {
        throw new Error(
          `Type ${operation.type.name.value} not defined in this file for ${
            operation.operation
          } schema.`,
        );
      }

      if (operation.operation === 'query') {
        dict.queryType = operation.type.name.value;
      } else if (operation.operation === 'mutation') {
        dict.mutationType = operation.type.name.value;
      }
    } else {
      throw new Error(`Operation ${operation.operation} not supported`);
    }
  }
}

for (const [name, object] of Object.entries(dict.objects)) {
  if (name === dict.queryType || name === dict.mutationType) {
    continue;
  }

  const fields =
    object.fields &&
    object.fields.map((field: any) => {
      const type = field.type;

      let required = type.kind === 'NonNullType';
      let fieldType: string | undefined;
      let thunkType: 'promise' | 'function' | undefined;

      if (type.kind === 'NamedType') {
        fieldType = type.name.value;
      } else if (required && type.type.kind === 'NamedType') {
        fieldType = type.type.name.value;
      }

      field.directives.forEach((directive: DirectiveNode) => {
        if (directive.name.value === 'function') {
          if (thunkType) {
            throw new Error('Thunk type already defined');
          }

          thunkType = 'function';
        } else if (directive.name.value === 'promise') {
          if (thunkType) {
            throw new Error('Thunk type already defined');
          }

          thunkType = 'promise';
        }
      });

      if (field.arguments.length > 0) {
        if (thunkType !== 'promise') {
          thunkType = 'function';
        }
      }

      return {
        name: field.name.value,
        comments: field.description && field.description.value,
        type: fieldType,
        required,
        thunkType,
        arguments: field.arguments,
      };
    });

  console.log({
    name,
    comments: object.description && object.description.value,
    fields,
  });
}
