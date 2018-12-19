/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as ts from 'typescript';

import { ObjectTypeDescription, ThunkType } from './parsing';

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

export function generateTypeAlias(
  descriptor: ObjectTypeDescription,
): ts.TypeAliasDeclaration {
  const members: ReadonlyArray<ts.TypeElement> = descriptor.fields.map(
    field => {
      let typeNode: ts.TypeNode;
      let requiredSignature: ts.Token<ts.SyntaxKind.QuestionToken> | undefined;
      let terminalTypeNode: ts.TypeNode;

      // Map to a type keyword based on the type
      if (field.type.kind === 'KnownType') {
        switch (field.type.type) {
          case 'boolean':
            terminalTypeNode = ts.createKeywordTypeNode(
              ts.SyntaxKind.BooleanKeyword,
            );
            break;
          case 'string':
            terminalTypeNode = ts.createKeywordTypeNode(
              ts.SyntaxKind.StringKeyword,
            );
            break;
          case 'number':
          default:
            terminalTypeNode = ts.createKeywordTypeNode(
              ts.SyntaxKind.NumberKeyword,
            );
            break;
        }
      } else {
        terminalTypeNode = ts.createKeywordTypeNode(
          ts.SyntaxKind.BooleanKeyword,
        );
      }

      // Wrap terminalTypeNode in an array if the type is array

      // Wrap in a function based in the thunk type
      switch (field.thunkType) {
        case ThunkType.asyncFunction:
        case ThunkType.function:
          requiredSignature = undefined;
          typeNode = generateFunctionTypeNode(
            terminalTypeNode,
            field.required,
            field.thunkType === ThunkType.asyncFunction,
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

      return ts.createPropertySignature(
        undefined,
        ts.createIdentifier(field.name),
        requiredSignature,
        typeNode,
        undefined,
      );
    },
  );

  const declaration = ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(descriptor.name),
    undefined,
    ts.createTypeLiteralNode(members),
  );

  return declaration;
}
