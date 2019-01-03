/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import ts from 'typescript';
import { camelCase } from 'lodash';

import {
  FieldDescriptor,
  ObjectTypeDescription,
  ThunkType,
  KnownScalarTypes,
} from './parsing';
import { TypesFileContents, ImportDescription } from './linking';
import { projectImportPath } from './paths';

/**
 * Receives a list of arguments and generates a type literal with the arguments
 * collapsed in an object-like structure. This is meant to be used as the
 * first argument in a resolver function.
 *
 * @param args List of arguments, if any, as FieldDescriptor structures.
 */
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

/**
 * Generates a function type node, to be part of the type alias declaration.
 *
 * @param terminalType TypeNode of the return value.
 * @param args List of arguments, if any.
 * @param isAsync Should this be an async function?
 */
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

/**
 * Receives a ts.Node element and attaches JSDoc comments.
 *
 * @param declaration TypeScript Node element that must have a JSDoc statement
 * added.
 *
 * @param text Text to be added.
 */
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

/**
 * Receives a TypeNode and a boolean. When the boolean is false, wraps the
 * typeNode in a Nullable generic.
 *
 * @param typeNode TypeScript API TypeNode element.
 * @param required Is it required?
 */
export function wrapInOptionalType(
  typeNode: ts.TypeNode,
  required: boolean,
): ts.TypeNode {
  if (required) {
    return typeNode;
  } else {
    return ts.createTypeReferenceNode(ts.createIdentifier('Maybe'), [typeNode]);
  }
}

/**
 * Given a field descriptor, which can be thunked, computes terminal element
 * that must be returned in the field descriptor.
 *
 * @param field Descriptor of the field where the terminal type needs to be
 * computed.
 */
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

  if (field.type.kind === 'KnownScalarType') {
    const typeValue = field.type.type;

    if (typeValue === KnownScalarTypes.String) {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    } else if (typeValue === KnownScalarTypes.Boolean) {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    } else if (typeValue === KnownScalarTypes.Number) {
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

/**
 * Given a field descriptor, generates the type element which is going to be
 * a member of the type alias declaration.
 *
 * @param field Descriptor of the field to generate.
 */
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

/**
 * Given a type descriptor, generates a type alias declaration which can be
 * used by the TypeScript API to autogenerate files.
 *
 * @param descriptor Object containing the type descriptor.
 */
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

export function defaultImportName(description: ImportDescription): string {
  if (description.kind === 'VendorImport') {
    const arr = description.moduleName.split('/');
    return arr[arr.length - 1];
  } else {
    const parsed = path.parse(description.fullPath);

    return camelCase(parsed.name);
  }
}

export function createImportDeclaration(importDescription: ImportDescription) {
  const importModuleName =
    importDescription.kind !== 'VendorImport'
      ? projectImportPath(importDescription.fullPath)
      : importDescription.moduleName;

  let defaultClause: ts.Identifier | undefined = undefined;

  const members = [...importDescription.membersMap.entries()];
  const importSpecifiers = members.reduce(
    (acc: ts.ImportSpecifier[], [name, alias]) => {
      if (name === 'default') {
        defaultClause = ts.createIdentifier(
          defaultImportName(importDescription),
        );

        return acc;
      }

      if (alias) {
        acc.push(
          ts.createImportSpecifier(
            ts.createIdentifier(name),
            ts.createIdentifier(alias),
          ),
        );
      } else {
        acc.push(
          ts.createImportSpecifier(undefined, ts.createIdentifier(name)),
        );
      }

      return acc;
    },
    [],
  );

  return ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(
      defaultClause,
      ts.createNamedImports(importSpecifiers),
    ),
    ts.createStringLiteral(importModuleName),
  );
}

type CodeGroup = ReadonlyArray<ts.Node>;

export function generateTypesFileNodes(
  contents: TypesFileContents,
): ReadonlyArray<CodeGroup> {
  const vendorImports = [...contents.vendorImports.values()].map(
    createImportDeclaration,
  );

  const fileImports = [...contents.fileImports.values()].map(
    createImportDeclaration,
  );

  const typeDeclarations = [...contents.typeDeclarations.values()].map(
    generateTypeAlias,
  );

  return [vendorImports, fileImports, typeDeclarations];
}
