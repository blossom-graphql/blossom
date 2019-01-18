/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { camelCase, upperFirst } from 'lodash';

import { OperationFieldDescriptor, FieldDescriptor } from './parsing';
import { SupportedOperation, ReferencedTypeDescriptor } from './parsing';

export function referencedTypeName(
  descriptor: ReferencedTypeDescriptor,
): string {
  return descriptor.name;
}

export function operationName(operation: SupportedOperation) {
  switch (operation) {
    case SupportedOperation.Mutation:
      return 'Mutation';
    case SupportedOperation.Query:
    default:
      return 'Query';
  }
}

export function resolverSignatureName({
  fieldDescriptor: descriptor,
  operation,
}: OperationFieldDescriptor): string {
  return (
    upperFirst(camelCase(descriptor.name)) +
    operationName(operation) +
    'Resolver'
  );
}

export function rootResolverName({
  fieldDescriptor: descriptor,
  operation,
}: OperationFieldDescriptor): string {
  return camelCase(descriptor.name) + operationName(operation) + 'Resolver';
}

export function resolverName(gqlTypeName: string): string {
  return camelCase(gqlTypeName) + 'Resolver';
}

export function signatureName(
  descriptor: OperationFieldDescriptor | FieldDescriptor,
) {
  if (descriptor.hasOwnProperty('operation')) {
    descriptor;
  }
}
