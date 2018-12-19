/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as ts from 'typescript';

ts.createNode;

import { FieldDescriptor, ObjectTypeDescription, ThunkType } from './parsing';

export function generateFunctionTypeNode(
  terminalType: ts.TypeNode,
  required: boolean,
  isAsync: boolean = false,
): ts.FunctionTypeNode {
  const outputTerminalType = required
    ? terminalType
    : ts.createUnionTypeNode([
        terminalType,
        ts.createKeywordTypeNode(ts.SyntaxKind.NullKeyword),
        ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]);

  const outputType = isAsync
    ? ts.createTypeReferenceNode(ts.createIdentifier('Promise'), [
        outputTerminalType,
      ])
    : outputTerminalType;

  const args = [
    ts.createParameter(
      undefined,
      undefined,
      undefined,
      ts.createIdentifier('args'),
      undefined,
      // TODO: Map me to the correct type.
      ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
    ),
    // Context parameter.
    ts.createParameter(
      undefined,
      undefined,
      undefined,
      ts.createIdentifier('context'),
      undefined,
      ts.createTypeReferenceNode(
        ts.createIdentifier('RequestContext'),
        undefined,
      ),
    ),
    // AST parameter.
    ts.createParameter(
      undefined,
      undefined,
      undefined,
      ts.createIdentifier('resolveInfo'),
      undefined,
      ts.createTypeReferenceNode(
        ts.createIdentifier('GraphQLResolveInfo'),
        undefined,
      ),
    ),
  ];

  return ts.createFunctionTypeNode(undefined, args, outputType);
}

export function appendJSDocComments(declaration: ts.Node, text: string) {
  const appendedLines = text
    .split('\n')
    .map(line => `* ${line}`)
    .join('\n');

  ts.addSyntheticLeadingComment(
    declaration,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `*\n${appendedLines}\n`,
    true,
  );
}

export function generateTerminalTypeNode(field: FieldDescriptor): ts.TypeNode {
  // If it's an array, then we must recurse based on the element descriptor
  if (field.array) {
    return ts.createArrayTypeNode(
      generateTerminalTypeNode(field.elementDescriptor),
    );
  }

  if (field.type.kind === 'KnownType') {
    const typeValue = field.type.type;

    if (typeValue === 'string') {
      return ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    } else if (typeValue === 'boolean') {
      return ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    } else if (typeValue === 'number') {
      return ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    }
  } else if (field.type.kind === 'ReferencedType') {
    return ts.createTypeReferenceNode(
      ts.createIdentifier(field.type.name),
      undefined,
    );
  }

  // TODO: Log warning.
  return ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
}

export function generateTypeAlias(
  descriptor: ObjectTypeDescription,
): ts.TypeAliasDeclaration {
  const members: ReadonlyArray<ts.TypeElement> = descriptor.fields.map(
    field => {
      let typeNode: ts.TypeNode;
      let requiredSignature: ts.Token<ts.SyntaxKind.QuestionToken> | undefined;

      const terminalTypeNode = generateTerminalTypeNode(field);

      // Wrap in a function based in the thunk type
      switch (field.thunkType) {
        case ThunkType.AsyncFunction:
        case ThunkType.Function:
          requiredSignature = undefined;
          typeNode = generateFunctionTypeNode(
            terminalTypeNode,
            field.required,
            field.thunkType === ThunkType.AsyncFunction,
          );
          break;

        default:
          // ThunkType.None
          requiredSignature = field.required
            ? undefined
            : ts.createToken(ts.SyntaxKind.QuestionToken);
          typeNode = terminalTypeNode;
          break;
      }

      const declaration = ts.createPropertySignature(
        undefined,
        ts.createIdentifier(field.name),
        requiredSignature,
        typeNode,
        undefined,
      );

      if (field.comments) {
        appendJSDocComments(declaration, field.comments);
      }

      return declaration;
    },
  );

  const declaration = ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(descriptor.name),
    undefined,
    ts.createTypeLiteralNode(members),
  );

  if (descriptor.comments) {
    appendJSDocComments(declaration, descriptor.comments);
  }

  return declaration;
}
