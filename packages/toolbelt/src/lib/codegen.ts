/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import ts from 'typescript';
import { camelCase, upperFirst } from 'lodash';
import wrap from 'word-wrap';

import {
  FieldDescriptor,
  ObjectTypeDescription,
  OperationDescriptor,
  ThunkType,
  KnownScalarTypes,
  EnumTypeDescription,
  UnionTypeDescription,
  KnownScalarTypeDescriptor,
  SupportedOperation,
} from './parsing';
import {
  TypesFileContents,
  ImportDescription,
  RootFileContents,
} from './linking';
import { projectImportPath } from './paths';
import {
  resolverSignatureName,
  rootResolverName,
  resolverName,
} from './naming';

const GRAPHQL_TYPENAME_FIELD = '__typename';
const GRAPHQL_TYPENAME_FIELD_COMMENTS = wrap(
  'Required by GraphQL.js. Must match the name of the object in the GraphQL SDL this type is representing in the codebase.',
  { width: 80, indent: '' },
);

export function createMockLiteral(
  descriptor: KnownScalarTypeDescriptor,
): ts.StringLiteral | ts.NumericLiteral | ts.BooleanLiteral {
  switch (descriptor.type) {
    case KnownScalarTypes.String:
      return ts.createStringLiteral('Your returned string');
    case KnownScalarTypes.Number:
      return ts.createNumericLiteral('0');
    case KnownScalarTypes.Boolean:
      return ts.createLiteral(false);
  }
}

export function signatureName(
  descriptor: OperationDescriptor | FieldDescriptor,
) {
  if (descriptor.hasOwnProperty('operation')) {
    descriptor;
  }
}

/**
 * Receives a list of arguments and generates a type literal with the arguments
 * collapsed in an object-like structure. This is meant to be used as the
 * first argument in a resolver function.
 *
 * @param args List of arguments, if any, as FieldDescriptor structures.
 */
export function generateArgumentsTypeLiteral(
  args: ReadonlyArray<FieldDescriptor> | undefined,
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

export function generateResolverFunctionArguments(
  args: ReadonlyArray<FieldDescriptor> | undefined,
  addResolverInfo: boolean = true,
): ReadonlyArray<ts.ParameterDeclaration> {
  const result = [
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
  ];

  if (addResolverInfo)
    result.push(
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
    );

  return result;
}

export function getOutputType(terminalType: ts.TypeNode, isAsync: boolean) {
  return isAsync
    ? ts.createTypeReferenceNode(ts.createIdentifier('Promise'), [terminalType])
    : terminalType;
}

/**
 * Generates a function type node, to be part of the type alias declaration.
 *
 * @param terminalType TypeNode of the return value.
 * @param args List of arguments, if any.
 * @param isAsync Should this be an async function?
 */
export function generateFunctionTypeNode(
  descriptor: OperationDescriptor | FieldDescriptor,
  operation?: SupportedOperation,
  // terminalType: ts.TypeNode,
  // args: FieldDescriptor[] | undefined,
  // isAsync: boolean = false,
): ts.TypeReferenceNode {
  if (descriptor.kind === 'OperationDescriptor')
    return generateFunctionTypeNode(
      descriptor.fieldDescriptor,
      descriptor.operation,
    );

  let signatureName: string;

  switch (operation) {
    case SupportedOperation.Mutation:
      signatureName = 'MutationResolverSignature';
      break;
    case SupportedOperation.Query:
      signatureName = 'QueryResolverSignature';
      break;
    default:
      signatureName = 'ObjectResolverSignature';
      break;
  }

  const terminalType = generateTerminalTypeNode(descriptor);
  const isAsync = descriptor.thunkType === ThunkType.AsyncFunction;

  const members = descriptor.arguments
    ? descriptor.arguments.map(generateTypeElement)
    : [];

  return ts.createTypeReferenceNode(ts.createIdentifier(signatureName), [
    ts.createTypeLiteralNode(members),
    getOutputType(terminalType, isAsync),
  ]);

  // return ts.createFunctionTypeNode(
  //   undefined,
  //   generateResolverFunctionArguments(args),
  //   getOutputType(terminalType, isAsync),
  // );
}

export function preprendComments(declaration: ts.Node, text: string) {
  const lines = text.split('\n');

  lines.forEach(line => {
    ts.addSyntheticLeadingComment(
      declaration,
      ts.SyntaxKind.SingleLineCommentTrivia,
      ` ${line}`,
      true,
    );
  });
}

/**
 * Receives a ts.Node element and attaches JSDoc comments.
 *
 * @param declaration TypeScript Node element that must have a JSDoc statement
 * added.
 *
 * @param text Text to be added.
 */
export function prependJSDocComments(declaration: ts.Node, text: string) {
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
export function generateTerminalTypeNode(
  field: OperationDescriptor | FieldDescriptor,
): ts.TypeNode {
  if (field.kind === 'OperationDescriptor')
    return generateTerminalTypeNode(field.fieldDescriptor);

  // If it's an array, then we must recurse based on the element descriptor
  if (field.kind === 'ArrayFieldDescriptor') {
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

export function getTerminalTypeName(fieldDescriptor: FieldDescriptor): string {
  if (fieldDescriptor.kind === 'ArrayFieldDescriptor') {
    return getTerminalTypeName(fieldDescriptor.elementDescriptor);
  }

  if (fieldDescriptor.type.kind === 'KnownScalarType') {
    return fieldDescriptor.type.type;
  } else {
    return fieldDescriptor.type.name;
  }
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

  // Wrap in a function based in the thunk type
  switch (field.thunkType) {
    case ThunkType.AsyncFunction:
    case ThunkType.Function:
      requiredSignature = undefined;
      typeNode = generateFunctionTypeNode(field);
      break;

    default:
      const terminalTypeNode = generateTerminalTypeNode(field);

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
    prependJSDocComments(declaration, field.comments);
  }

  return declaration;
}

export function generateEnumDeclaration(enumDescriptor: EnumTypeDescription) {
  const members: ts.EnumMember[] = enumDescriptor.fields.map(field => {
    const enumFieldName = upperFirst(camelCase(field.originalName));

    const member = ts.createEnumMember(
      ts.createIdentifier(enumFieldName),
      ts.createStringLiteral(field.originalName),
    );

    if (field.comments) prependJSDocComments(member, field.comments);

    return member;
  });

  const declaration = ts.createEnumDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(enumDescriptor.name),
    members,
  );

  if (enumDescriptor.comments)
    prependJSDocComments(declaration, enumDescriptor.comments);

  return declaration;
}

/**
 * Given a type descriptor, generates a type alias declaration which can be
 * used by the TypeScript API to autogenerate files.
 *
 * @param descriptor Object containing the type descriptor.
 */
export function generateObjectTypeAlias(
  descriptor: ObjectTypeDescription,
): ts.TypeAliasDeclaration {
  const members: ReadonlyArray<ts.TypeElement> = descriptor.fields.map(
    generateTypeElement,
  );

  const typenameElement = ts.createPropertySignature(
    undefined,
    ts.createIdentifier(GRAPHQL_TYPENAME_FIELD),
    undefined,
    // ! ALWAYS the literal name, whatever the typename is converted in the lib.
    // ! This goes to GraphQL.js for presenting results.
    ts.createLiteralTypeNode(ts.createStringLiteral(descriptor.name)),
    undefined,
  );

  prependJSDocComments(typenameElement, GRAPHQL_TYPENAME_FIELD_COMMENTS);

  const declaration = ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(descriptor.name),
    undefined,
    ts.createTypeLiteralNode([typenameElement, ...members]),
  );

  if (descriptor.comments) {
    prependJSDocComments(declaration, descriptor.comments);
  }

  return declaration;
}

export function generateUnionTypeAlias(
  descriptor: UnionTypeDescription,
): ts.TypeAliasDeclaration {
  const declaration = ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(descriptor.name),
    undefined,
    ts.createUnionTypeNode(
      descriptor.members.map(typeName =>
        ts.createTypeReferenceNode(ts.createIdentifier(typeName), undefined),
      ),
    ),
  );

  if (descriptor.comments) {
    prependJSDocComments(declaration, descriptor.comments);
  }

  return declaration;
}

export function generateResolverSignatureDeclaration(
  descriptor: OperationDescriptor,
): ts.TypeAliasDeclaration {
  const functionTypeNode = generateFunctionTypeNode(descriptor);
  const { fieldDescriptor } = descriptor;

  const declaration = ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(resolverSignatureName(descriptor)),
    undefined,
    functionTypeNode,
  );

  if (fieldDescriptor.comments) {
    prependJSDocComments(declaration, fieldDescriptor.comments);
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

type CodeGroup = { spacing: number; nodes: ReadonlyArray<ts.Node> };

export function generateTypesFileNodes(
  contents: TypesFileContents,
): ReadonlyArray<CodeGroup> {
  const vendorImports = [...contents.vendorImports.values()].map(
    createImportDeclaration,
  );

  const fileImports = [...contents.fileImports.values()].map(
    createImportDeclaration,
  );

  const enumDeclarations = contents.enumDeclarations.map(
    generateEnumDeclaration,
  );

  const objectTypeDeclarations = contents.typeDeclarations.map(
    generateObjectTypeAlias,
  );

  const unionTypeDeclarations = contents.unionDeclarations.map(
    generateUnionTypeAlias,
  );

  const resolverSignatureDeclarations = contents.operationDeclarations.map(
    generateResolverSignatureDeclaration,
  );

  return [
    { spacing: 0, nodes: vendorImports },
    { spacing: 0, nodes: fileImports },
    { spacing: 1, nodes: enumDeclarations },
    { spacing: 1, nodes: objectTypeDeclarations },
    { spacing: 1, nodes: unionTypeDeclarations },
    { spacing: 1, nodes: resolverSignatureDeclarations },
  ];
}

export function generateRootValueReturnExpression(
  descriptor: OperationDescriptor | FieldDescriptor,
): ts.Expression {
  if (descriptor.kind === 'OperationDescriptor') {
    return generateRootValueReturnExpression(descriptor.fieldDescriptor);
  } else if (descriptor.kind === 'ArrayFieldDescriptor') {
    if (
      descriptor.elementDescriptor.kind === 'SingleFieldDescriptor' &&
      descriptor.elementDescriptor.type.kind === 'KnownScalarType'
    ) {
      return ts.createArrayLiteral([
        createMockLiteral(descriptor.elementDescriptor.type),
      ]);
    } else {
      return generateRootValueReturnExpression(descriptor.elementDescriptor);
    }
  } else {
    const terminalTypeName = getTerminalTypeName(descriptor);

    if (descriptor.type.kind === 'KnownScalarType') {
      return createMockLiteral(descriptor.type);
    } else {
      return ts.createCall(
        ts.createIdentifier(resolverName(terminalTypeName)),
        undefined,
        [
          ts.createObjectLiteral(
            [
              ts.createShorthandPropertyAssignment('attributes'),
              ts.createShorthandPropertyAssignment('context'),
            ],
            true,
          ),
        ],
      );
    }
  }
}

export function generateRootFileNodes(
  contents: RootFileContents,
): ReadonlyArray<CodeGroup> {
  const vendorImports = [...contents.vendorImports.values()].map(
    createImportDeclaration,
  );

  const fileImports = [...contents.fileImports.values()].map(
    createImportDeclaration,
  );

  const functionDeclarations = contents.operationDeclarations.map(
    operationDescriptor => {
      const { fieldDescriptor } = operationDescriptor;
      const terminalType = getOutputType(
        generateTerminalTypeNode(operationDescriptor),
        operationDescriptor.fieldDescriptor.thunkType ===
          ThunkType.AsyncFunction,
      );

      const name = rootResolverName(operationDescriptor);

      const commentStatement = ts.createEmptyStatement();
      preprendComments(
        commentStatement,
        'Inside this function you must find a way to retrieve attributes in order' +
          '\nto pass it to the resolver. Example: call a loader or a connection. Use' +
          '\nargs for this purpose.',
      );

      const returnStatement: ts.ReturnStatement = ts.createReturn(
        generateRootValueReturnExpression(operationDescriptor),
      );

      const functionContents = ts.createBlock(
        [commentStatement, returnStatement],
        true,
      );

      const functionExpression = ts.createFunctionExpression(
        [ts.createModifier(ts.SyntaxKind.AsyncKeyword)],
        undefined,
        ts.createIdentifier(name),
        undefined,
        // At the moment we are hardwiring this to false. However, when we try
        // to further optimize the loading of specific fields, the actual field
        // list should be retrieved from resolveInfo.
        //
        // Thus, this should be wired to a setting, a directive or something
        // similar. E.g. if we use a different kind of loader for this resource,
        // then resolveInfo should be included in the list of arguments.
        generateResolverFunctionArguments(fieldDescriptor.arguments, false),
        terminalType,
        functionContents,
      );

      const declaration = ts.createVariableStatement(
        [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.createVariableDeclarationList(
          [
            ts.createVariableDeclaration(
              ts.createIdentifier(name),
              ts.createTypeReferenceNode(
                ts.createIdentifier(resolverSignatureName(operationDescriptor)),
                undefined,
              ),
              functionExpression,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      );

      return declaration;
    },
  );

  return [
    { spacing: 0, nodes: vendorImports },
    { spacing: 0, nodes: fileImports },
    { spacing: 1, nodes: functionDeclarations },
  ];
}
