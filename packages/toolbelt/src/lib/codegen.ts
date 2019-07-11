/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import ts from 'typescript';
import { camelCase, flatMap, upperFirst } from 'lodash';
import wrap from 'word-wrap';
import pluralize from 'pluralize';

import {
  FieldDescriptor,
  ObjectTypeDescriptor,
  ThunkType,
  KnownScalarTypes,
  EnumTypeDescriptor,
  UnionTypeDescriptor,
  KnownScalarTypeDescriptor,
  SupportedOperation,
  OperationFieldDescriptor,
  ObjectTypeAnnotation,
} from './parsing';
import {
  TypesFileContents,
  ImportDescription,
  RootFileContents,
  MUTATION_SIGNATURE_NAME,
  QUERY_SIGNATURE_NAME,
  OBJECT_SIGNATURE_NAME,
  SourcesFileContents,
  ResolversFileContents,
  INSTANCE_RESOLVE_NAME,
  INSTANCE_ROOT_QUERY_NAME,
  INSTANCE_ROOT_MUTATION_NAME,
  CORE_BATCHFN_NAME,
  MAYBE_NAME,
  CORE_RESOLVER_NAME,
  INSTANCE_CONTEXT_NAME,
  INSTANCE_RESOLVE_ARRAY_NAME,
  CORE_CONNECTION_NAME,
  CORE_CONNECTION_RESOLVER_CREATOR_NAME,
  CORE_CONNECTION_DATA_NAME,
} from './linking';
import { projectImportPath } from './paths';
import {
  rootResolverSignatureName,
  rootResolverName,
  resolverName,
  loaderName,
  referencedTypeName,
  resolverConnectionName,
} from './naming';
import {
  SOURCE_COMMENT,
  RESOLVER_OTHER_PROPS_COMMENT,
  RESOLVER_COMMENTS,
  RESOLVER_TYPENAME_COMMENT,
  ROOT_BLOCK_COMMENT,
  ROOT_REGISTRATION_COMMENT,
  CONNECTION_TYPE_COMMENT,
  CONNECTION_RESOLVER_COMMENT,
} from './cmd/codegen/comments';

export const CODE_GROUP_SPACING = '\n\n';
const GRAPHQL_TYPENAME_FIELD = '__typename';
const GRAPHQL_TYPENAME_FIELD_COMMENTS = wrap(
  'Required by GraphQL.js. Must match the name of the object in the GraphQL SDL this type is representing in the codebase.',
  { width: 80, indent: '' },
);

export function createMockLiteral(
  descriptor: KnownScalarTypeDescriptor,
): ts.StringLiteral | ts.NumericLiteral | ts.BooleanLiteral {
  switch (descriptor.type) {
    case KnownScalarTypes.ID:
      return ts.createStringLiteral('a-unique-identifier');
    case KnownScalarTypes.String:
      return ts.createStringLiteral('Your returned string');
    case KnownScalarTypes.Number:
      return ts.createNumericLiteral('0');
    case KnownScalarTypes.Boolean:
      return ts.createLiteral(false);
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
  if (!args || args.length === 0) {
    return ts.createParameter(
      undefined,
      undefined,
      undefined,
      ts.createIdentifier('_args'),
      undefined,
      ts.createTypeLiteralNode([]),
    );
  }

  return ts.createParameter(
    undefined,
    undefined,
    undefined,
    ts.createIdentifier('args'),
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
      ts.createIdentifier('ctx'),
      undefined,
      ts.createTypeReferenceNode(ts.createIdentifier('RequestContext'), undefined),
    ),
  ];

  if (addResolverInfo)
    result.push(
      // AST parameter.
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        ts.createIdentifier('ast'),
        undefined,
        ts.createTypeReferenceNode(ts.createIdentifier('GraphQLResolveInfo'), undefined),
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
  descriptor: OperationFieldDescriptor | FieldDescriptor,
  operation?: SupportedOperation,
  // terminalType: ts.TypeNode,
  // args: FieldDescriptor[] | undefined,
  // isAsync: boolean = false,
): ts.TypeReferenceNode {
  if (descriptor.kind === 'OperationFieldDescriptor')
    return generateFunctionTypeNode(descriptor.fieldDescriptor, descriptor.operation);

  let signatureName: string;
  switch (operation) {
    case SupportedOperation.Mutation:
      signatureName = MUTATION_SIGNATURE_NAME;
      break;
    case SupportedOperation.Query:
      signatureName = QUERY_SIGNATURE_NAME;
      break;
    default:
      signatureName = OBJECT_SIGNATURE_NAME;
      break;
  }

  const terminalType = generateTerminalTypeNode(descriptor);
  const isAsync = descriptor.thunkType === ThunkType.AsyncFunction;

  const members = descriptor.arguments ? descriptor.arguments.map(generateTypeElement) : [];

  return ts.createTypeReferenceNode(ts.createIdentifier(signatureName), [
    ts.createTypeLiteralNode(members),
    getOutputType(terminalType, isAsync),
    ts.createTypeReferenceNode(ts.createIdentifier(INSTANCE_CONTEXT_NAME), undefined),
  ]);
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
export function wrapInOptionalType(typeNode: ts.TypeNode, required: boolean): ts.TypeNode {
  if (required) {
    return typeNode;
  } else {
    return ts.createTypeReferenceNode(ts.createIdentifier(MAYBE_NAME), [typeNode]);
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
  field: OperationFieldDescriptor | FieldDescriptor,
): ts.TypeNode {
  if (field.kind === 'OperationFieldDescriptor')
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

  let terminalType: ts.TypeNode;
  if (field.type.kind === 'KnownScalarType') {
    const typeValue = field.type.type;

    if (typeValue === KnownScalarTypes.String || typeValue === KnownScalarTypes.ID) {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    } else if (typeValue === KnownScalarTypes.Boolean) {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    } else if (typeValue === KnownScalarTypes.Number) {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    } else {
      terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    }
  } else if (field.type.kind === 'ReferencedType') {
    terminalType = ts.createTypeReferenceNode(ts.createIdentifier(field.type.name), undefined);
  } else {
    terminalType = ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    // TODO: Log warning.
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
      requiredSignature = field.required ? undefined : ts.createToken(ts.SyntaxKind.QuestionToken);
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

export function generateEnumDeclaration(enumDescriptor: EnumTypeDescriptor) {
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

  if (enumDescriptor.comments) prependJSDocComments(declaration, enumDescriptor.comments);

  return declaration;
}

/**
 * Given a type descriptor, generates a type alias declaration which can be
 * used by the TypeScript API to autogenerate files.
 *
 * @param descriptor Object containing the type descriptor.
 */
export function generateObjectTypeAlias(
  descriptor: ObjectTypeDescriptor,
): ts.TypeAliasDeclaration[] {
  if (descriptor.virtual) {
    return [];
  }

  const members: readonly ts.TypeElement[] = descriptor.fields.map(generateTypeElement);

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

  const declarations: ts.TypeAliasDeclaration[] = [declaration];
  if (!descriptor.annotations.has(ObjectTypeAnnotation.HasConnection)) {
    return declarations;
  }

  const connectionDeclaration = ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(descriptor.name + 'Connection'),
    undefined,
    ts.createTypeReferenceNode(ts.createIdentifier(CORE_CONNECTION_NAME), [
      ts.createTypeReferenceNode(ts.createIdentifier(descriptor.name), undefined),
      ts.createTypeReferenceNode(ts.createIdentifier(INSTANCE_CONTEXT_NAME), undefined),
    ]),
  );
  prependJSDocComments(connectionDeclaration, CONNECTION_TYPE_COMMENT(descriptor.name));
  declarations.push(connectionDeclaration);

  return declarations;
}

export function generateUnionTypeAlias(descriptor: UnionTypeDescriptor): ts.TypeAliasDeclaration {
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
  descriptor: OperationFieldDescriptor,
): ts.TypeAliasDeclaration {
  const functionTypeNode = generateFunctionTypeNode(descriptor);
  const { fieldDescriptor } = descriptor;

  const declaration = ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(rootResolverSignatureName(descriptor)),
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
  const importSpecifiers = members.reduce((acc: ts.ImportSpecifier[], [name, alias]) => {
    if (name === 'default') {
      defaultClause = ts.createIdentifier(defaultImportName(importDescription));

      return acc;
    }

    if (alias) {
      acc.push(ts.createImportSpecifier(ts.createIdentifier(name), ts.createIdentifier(alias)));
    } else {
      acc.push(ts.createImportSpecifier(undefined, ts.createIdentifier(name)));
    }

    return acc;
  }, []);

  return ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(defaultClause, ts.createNamedImports(importSpecifiers)),
    ts.createStringLiteral(importModuleName),
  );
}

export type CodeGroup = { spacing: number; nodes: ReadonlyArray<ts.Node> };

export function generateTypesFileNodes(contents: TypesFileContents): ReadonlyArray<CodeGroup> {
  const vendorImports = [...contents.vendorImports.values()].map(createImportDeclaration);

  const fileImports = [...contents.fileImports.values()].map(createImportDeclaration);

  const enumDeclarations = contents.enumDeclarations.map(generateEnumDeclaration);

  const objectTypeDeclarations = contents.typeDeclarations.flatMap(generateObjectTypeAlias);

  const unionTypeDeclarations = contents.unionDeclarations.map(generateUnionTypeAlias);

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
  descriptor: OperationFieldDescriptor | FieldDescriptor,
): ts.Expression {
  if (descriptor.kind === 'OperationFieldDescriptor') {
    return generateRootValueReturnExpression(descriptor.fieldDescriptor);
  } else if (descriptor.kind === 'ArrayFieldDescriptor') {
    if (descriptor.elementDescriptor.kind === 'SingleFieldDescriptor') {
      if (descriptor.elementDescriptor.type.kind === 'KnownScalarType') {
        return ts.createArrayLiteral([createMockLiteral(descriptor.elementDescriptor.type)]);
      } else {
        const terminalTypeName = getTerminalTypeName(descriptor);

        return ts.createCall(ts.createIdentifier(INSTANCE_RESOLVE_ARRAY_NAME), undefined, [
          ts.createObjectLiteral(
            [
              ts.createShorthandPropertyAssignment('data'),
              ts.createShorthandPropertyAssignment('ctx'),
              ts.createPropertyAssignment(
                ts.createIdentifier('using'),
                ts.createIdentifier(resolverName(terminalTypeName)),
              ),
              ts.createShorthandPropertyAssignment('ast'),
            ],
            true,
          ),
        ]);
      }
    } else {
      return generateRootValueReturnExpression(descriptor.elementDescriptor);
    }
  } else {
    const terminalTypeName = getTerminalTypeName(descriptor);

    if (descriptor.type.kind === 'KnownScalarType') {
      return createMockLiteral(descriptor.type);
    } else {
      return ts.createCall(ts.createIdentifier(INSTANCE_RESOLVE_NAME), undefined, [
        ts.createObjectLiteral(
          [
            ts.createShorthandPropertyAssignment('data'),
            ts.createShorthandPropertyAssignment('ctx'),
            ts.createPropertyAssignment(
              ts.createIdentifier('using'),
              ts.createIdentifier(resolverName(terminalTypeName)),
            ),
            ts.createShorthandPropertyAssignment('ast'),
          ],
          true,
        ),
      ]);
    }
  }
}

export function generateRootFileNodes(contents: RootFileContents): ReadonlyArray<CodeGroup> {
  const vendorImports = [...contents.vendorImports.values()].map(createImportDeclaration);

  const fileImports = [...contents.fileImports.values()].map(createImportDeclaration);

  const functionDeclarations = flatMap(contents.operationDeclarations, operationDescriptor => {
    const name = rootResolverName(operationDescriptor);

    const commentStatement = ts.createEmptyStatement();
    preprendComments(commentStatement, ROOT_BLOCK_COMMENT);

    const returnStatement: ts.ReturnStatement = ts.createReturn(
      generateRootValueReturnExpression(operationDescriptor),
    );

    const functionContents = ts.createBlock([commentStatement, returnStatement], true);

    const functionExpression = ts.createFunctionExpression(
      [ts.createModifier(ts.SyntaxKind.AsyncKeyword)],
      undefined,
      ts.createIdentifier(name),
      undefined,
      [
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          ts.createIdentifier('args'),
          undefined,
          undefined,
          undefined,
        ),
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          ts.createIdentifier('ctx'),
          undefined,
          undefined,
          undefined,
        ),
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          ts.createIdentifier('ast'),
          undefined,
          undefined,
          undefined,
        ),
      ],
      undefined,
      functionContents,
    );

    const functionDeclaration = ts.createVariableStatement(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.createVariableDeclarationList(
        [
          ts.createVariableDeclaration(
            ts.createIdentifier(name),
            ts.createTypeReferenceNode(
              ts.createIdentifier(rootResolverSignatureName(operationDescriptor)),
              undefined,
            ),
            functionExpression,
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    let operationRegistrationFunctionName: string;
    switch (operationDescriptor.operation) {
      case SupportedOperation.Query:
        operationRegistrationFunctionName = INSTANCE_ROOT_QUERY_NAME;
        break;
      case SupportedOperation.Mutation:
        operationRegistrationFunctionName = INSTANCE_ROOT_MUTATION_NAME;
        break;
      default:
        throw new Error(`Operation ${operationDescriptor.operation} not supported`);
        break;
    }

    const operationRegistrationCall = ts.createCall(
      ts.createIdentifier(operationRegistrationFunctionName),
      undefined,
      [
        ts.createObjectLiteral([
          ts.createPropertyAssignment(
            ts.createIdentifier('implements'),
            ts.createStringLiteral(operationDescriptor.fieldDescriptor.name),
          ),
          ts.createPropertyAssignment(ts.createIdentifier('using'), ts.createIdentifier(name)),
        ]),
      ],
    );
    preprendComments(operationRegistrationCall, ROOT_REGISTRATION_COMMENT);

    return [functionDeclaration, operationRegistrationCall];
  });

  return [
    { spacing: 0, nodes: vendorImports },
    { spacing: 0, nodes: fileImports },
    { spacing: 1, nodes: functionDeclarations },
  ];
}

export function generateSourcesFileNodes(contents: SourcesFileContents): ReadonlyArray<CodeGroup> {
  const vendorImports = [...contents.vendorImports.values()].map(createImportDeclaration);

  const fileImports = [...contents.fileImports.values()].map(createImportDeclaration);

  const batchFnStatements = flatMap(contents.batchFnDeclarations, declaration => {
    return declaration.idFields.map(fieldDescriptor => {
      const name = loaderName(declaration.objectDescriptor, fieldDescriptor);

      const loaderSignature = ts.createTypeReferenceNode(ts.createIdentifier(CORE_BATCHFN_NAME), [
        generateTerminalTypeNode(fieldDescriptor),
        ts.createTypeReferenceNode(ts.createIdentifier(MAYBE_NAME), [
          ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        ]),
        ts.createTypeReferenceNode(ts.createIdentifier(INSTANCE_CONTEXT_NAME), undefined),
      ]);

      const exceptionExpression = ts.createThrow(
        ts.createNew(ts.createIdentifier('Error'), undefined, [
          ts.createStringLiteral('Not implemented.'),
        ]),
      );
      preprendComments(exceptionExpression, SOURCE_COMMENT);

      const functionExpression = ts.createFunctionExpression(
        [ts.createModifier(ts.SyntaxKind.AsyncKeyword)],
        undefined,
        ts.createIdentifier(name),
        undefined,
        [
          ts.createParameter(
            undefined,
            undefined,
            undefined,
            ts.createIdentifier(pluralize.plural(fieldDescriptor.name)),
            undefined,
            undefined,
          ),
        ],
        undefined,
        ts.createBlock([exceptionExpression]),
      );

      return ts.createVariableStatement(
        [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.createVariableDeclarationList(
          [
            ts.createVariableDeclaration(
              ts.createIdentifier(name),
              loaderSignature,
              functionExpression,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      );
    });
  });

  return [
    { spacing: 0, nodes: vendorImports },
    { spacing: 0, nodes: fileImports },
    { spacing: 1, nodes: batchFnStatements },
  ];
}

export function generateResolversFileNodes(
  contents: ResolversFileContents,
): ReadonlyArray<CodeGroup> {
  const vendorImports = [...contents.vendorImports.values()].map(createImportDeclaration);

  const fileImports = [...contents.fileImports.values()].map(createImportDeclaration);

  const resolverStatements = contents.typeDeclarations.flatMap(objectDescriptor => {
    if (objectDescriptor.virtual) {
      return []; // these are skipped
    }

    const objectResolver = generateResolverStatement(objectDescriptor);
    if (!objectDescriptor.annotations.has(ObjectTypeAnnotation.HasConnection)) {
      return [objectResolver];
    }

    const connectionResolver = generateConnectionResolverStatement(objectDescriptor);
    return [objectResolver, connectionResolver];
  });

  return [
    { spacing: 0, nodes: vendorImports },
    { spacing: 0, nodes: fileImports },
    { spacing: 1, nodes: resolverStatements },
  ];
}

function generateResolverStatement(objectDescriptor: ObjectTypeDescriptor): ts.VariableStatement {
  const functionName = resolverName(objectDescriptor.name);

  const resolverSignature = ts.createTypeReferenceNode(ts.createIdentifier(CORE_RESOLVER_NAME), [
    ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
    ts.createTypeReferenceNode(
      ts.createIdentifier(referencedTypeName(objectDescriptor.name)),
      undefined,
    ),
    ts.createTypeReferenceNode(ts.createIdentifier(INSTANCE_CONTEXT_NAME), undefined),
  ]);

  const attributesParameter = ts.createParameter(
    undefined,
    undefined,
    undefined,
    ts.createIdentifier('attributes'),
    undefined,
    undefined,
  );

  const commentsStatement = ts.createEmptyStatement();
  preprendComments(commentsStatement, RESOLVER_COMMENTS);

  const typenameAssignment = ts.createPropertyAssignment(
    ts.createIdentifier(GRAPHQL_TYPENAME_FIELD),
    ts.createStringLiteral(objectDescriptor.name),
  );
  preprendComments(typenameAssignment, RESOLVER_TYPENAME_COMMENT);

  const otherPropsAssignment = ts.createSpreadAssignment(ts.createIdentifier('otherProps'));
  preprendComments(otherPropsAssignment, RESOLVER_OTHER_PROPS_COMMENT);

  return ts.createVariableStatement(
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          ts.createIdentifier(functionName),
          resolverSignature, // TODO: Change to resolver signature
          ts.createFunctionExpression(
            undefined,
            undefined,
            ts.createIdentifier(functionName),
            undefined,
            [attributesParameter],
            undefined,
            ts.createBlock([
              commentsStatement,
              ts.createReturn(ts.createObjectLiteral([typenameAssignment, otherPropsAssignment])),
            ]),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

function generateConnectionResolverStatement(
  objectDescriptor: ObjectTypeDescriptor,
): ts.VariableStatement {
  const functionName = resolverConnectionName(objectDescriptor.name);
  const resolverFunctionName = resolverName(objectDescriptor.name);

  const resolverSignature = ts.createTypeReferenceNode(ts.createIdentifier(CORE_RESOLVER_NAME), [
    ts.createTypeReferenceNode(ts.createIdentifier(CORE_CONNECTION_DATA_NAME), [
      ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
      ts.createTypeReferenceNode(ts.createIdentifier(INSTANCE_CONTEXT_NAME), undefined),
    ]),
    ts.createTypeReferenceNode(ts.createIdentifier(CORE_CONNECTION_NAME), [
      ts.createTypeReferenceNode(
        ts.createIdentifier(referencedTypeName(objectDescriptor.name)),
        undefined,
      ),
      ts.createTypeReferenceNode(ts.createIdentifier(INSTANCE_CONTEXT_NAME), undefined),
    ]),
    ts.createTypeReferenceNode(ts.createIdentifier(INSTANCE_CONTEXT_NAME), undefined),
  ]);

  const statement = ts.createVariableStatement(
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          ts.createIdentifier(functionName),
          resolverSignature,
          ts.createCall(ts.createIdentifier(CORE_CONNECTION_RESOLVER_CREATOR_NAME), undefined, [
            ts.createStringLiteral(objectDescriptor.name),
            ts.createIdentifier(resolverFunctionName),
          ]),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
  preprendComments(statement, CONNECTION_RESOLVER_COMMENT);

  return statement;
}
