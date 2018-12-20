/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as ts from 'typescript';

import { FieldDescriptor, ObjectTypeDescription, ThunkType } from './parsing';

export function generateArgumentsTypeLiteral(
  args: FieldDescriptor[] | undefined,
): ts.ParameterDeclaration {
  const name = ts.createIdentifier('args');

  if (!args || args.length === 0) {
    return ts.createParameter(
      undefined,
      undefined,
      undefined,
      name,
      undefined,
      ts.createTypeLiteralNode([]),
    );
  }

  return ts.createParameter(
    undefined,
    undefined,
    undefined,
    name,
    undefined,
    ts.createTypeLiteralNode(args.map(generateTypeElement)),
  );
}

export function generateFunctionTypeNode(
  terminalType: ts.TypeNode,
  args: FieldDescriptor[] | undefined,
  isAsync: boolean = false,
): ts.FunctionTypeNode {
  const outputType = isAsync
    ? ts.createTypeReferenceNode(ts.createIdentifier('Promise'), [terminalType])
    : terminalType;

  const signatureArgs = [
    generateArgumentsTypeLiteral(args),
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

  return ts.createFunctionTypeNode(undefined, signatureArgs, outputType);
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

export function wrapInOptionalType(
  typeNode: ts.TypeNode,
  required: boolean,
): ts.TypeNode {
  if (required) {
    return typeNode;
  } else {
    return ts.createTypeReferenceNode(ts.createIdentifier('Nullable'), [
      typeNode,
    ]);
  }
}

export function generateTerminalTypeNode(field: FieldDescriptor): ts.TypeNode {
  // If it's an array, then we must recurse based on the element descriptor
  if (field.array) {
    return wrapInOptionalType(
      ts.createTypeReferenceNode(ts.createIdentifier('ReadonlyArray'), [
        generateTerminalTypeNode(field.elementDescriptor),
      ]),
      field.required,
    );
  }

  let terminalType: ts.TypeNode = ts.createKeywordTypeNode(
    ts.SyntaxKind.UnknownKeyword,
  );

  if (field.type.kind === 'KnownType') {
    const typeValue = field.type.type;

    if (typeValue === 'string') {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    } else if (typeValue === 'boolean') {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    } else if (typeValue === 'number') {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    }
  } else if (field.type.kind === 'ReferencedType') {
    terminalType = ts.createTypeReferenceNode(
      ts.createIdentifier(field.type.name),
      undefined,
    );
  } else {
    // TODO: Log warning.
    return terminalType;
  }

  return wrapInOptionalType(terminalType, field.required);
}

export function generateTypeElement(field: FieldDescriptor): ts.TypeElement {
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
        field.arguments,
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
}

export function generateTypeAlias(
  descriptor: ObjectTypeDescription,
): ts.TypeAliasDeclaration {
  const members: ReadonlyArray<ts.TypeElement> = descriptor.fields.map(
    generateTypeElement,
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
