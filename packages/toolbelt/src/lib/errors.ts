/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import chalk from 'chalk';
import wrap from 'word-wrap';

import { ResolutionDescription, ElementKind, OriginDescription } from './linking';
import { ErrorsOutput, makeTitleOriginDescriptor } from './utils';
import { ObjectTypeDescriptor, EnumTypeDescriptor, UnionTypeDescriptor } from './parsing';

export class ExtendableError extends Error {
  constructor(error?: string | undefined) {
    super(error);

    this.name = this.constructor.name;
  }
}

interface FormattableError {
  cliFormat: () => string;
}

export function formatCLIError(error: Error): string {
  if ((error as any).cliFormat) {
    return (error as any).cliFormat() as string;
  } else {
    return error.toString();
  }
}

/**
 * Error thrown when an operation name in SchemaDefinitionNode of the GraphQL
 * parsed Document is not supported in this library.
 */
export class UnsupportedOperationError extends Error {
  constructor(operationName: string) {
    super(
      `Unsupported operation type ${operationName}. ` +
        `Check your definitions for the schema {} declaration.`,
    );
  }
}

/**
 * Error class thrown when a type definitions is required and is not found on the
 * intermediate dictionary.
 */
export class UnknownTypeError extends Error {
  constructor(name: string) {
    super(
      `Cannot find reference for type ${name}. Did you spell it correctly? ` +
        `If this type is defined in another schema file, please import it on ` +
        `top using an #import statement.`,
    );
  }
}

/**
 * Used to indicate that a schema declaration is already defined in the
 * intermediateDict.
 */
export class SchemaCollisionError extends Error {
  constructor() {
    super('Schema definition already defined in intermediateDict.');
  }
}

/**
 * Used to indicate that an operation type is already defined in the
 * intermediateDict.
 */
export class OperationTypeCollisionError extends Error {
  constructor() {
    super(`Operation types already defined in intermediateDict.`);
  }
}

export class ImportParsingError extends Error {
  name = 'ImportParsingError';
  filePath: string;
  originalError: Error;

  constructor(filePath: string, originalError: Error) {
    super(
      `Error while parsing file ${filePath}: ${originalError.message}. Expand originalError for more info.`,
    );

    this.filePath = filePath;
    this.originalError = originalError;
    this.stack = originalError.stack;
  }
}

export class FileNotFoundInGraph extends Error {
  constructor(filePath: string) {
    super(
      `File ${filePath} not found among the referenced parsed files. This is an internal error.`,
    );
  }
}

export class InvalidReferenceError extends ExtendableError implements FormattableError {
  field: string;
  filePath: string;
  reference: OriginDescription;

  constructor(field: string, filePath: string, reference: OriginDescription) {
    super(
      `Reference to ${field} in file ${filePath} is invalid. ${field} cannot be referenced from kind ${reference.originKind}`,
    );

    this.field = field;
    this.filePath = filePath;
    this.reference = reference;
  }

  cliFormat() {
    const title = chalk.red(`File ${this.filePath}\n${makeTitleOriginDescriptor(this.reference)}`);
    const message = `\nReference to ${chalk.bold(
      this.field,
    )} is invalid. This usually means you're trying to reference a type that cannot be used in the current declaration. Some examples:`;
    const help =
      `\n- Trying to reference an Input from an Object type.` +
      `\n- Trying to reference an Object from an Input type.` +
      `\nCheck your declarations in this file before proceeding.`;

    return title + message + help;
  }
}

export class ReferenceNotFoundError extends ExtendableError implements FormattableError {
  field: string;
  filePath: string;
  references: ReadonlyArray<OriginDescription>;

  constructor(field: string, filePath: string, references: ReadonlyArray<OriginDescription>) {
    super(
      `Reference to ${field} required by file ${filePath} not found. Did you forget an \`# import\` statement?`,
    );

    this.field = field;
    this.filePath = filePath;
    this.references = references;
  }

  cliFormat() {
    const titles: string[] = this.references.map(reference =>
      chalk.red(`File ${this.filePath}\n${makeTitleOriginDescriptor(reference)}`),
    );

    const message = `\nReference to ${chalk.bold(this.field)} was nowhere to be found.`;
    const help = '\nDid you forget an ' + chalk.gray('# import') + ' statement in this file?';

    return titles.join('\n') + message + help;
  }
}

export class LinkingError extends ExtendableError implements FormattableError {
  errors: ErrorsOutput;

  constructor(errors: ErrorsOutput) {
    super(`Linking errors`);

    this.errors = [];

    errors.forEach(error => {
      const [index, errorInstance] = error;

      // If the error comes from a child LinkingError, put all the child errors
      // in this instance.
      if (errorInstance instanceof LinkingError) {
        this.errors.push(
          ...errorInstance.errors.map(([_, linkingError]): [number, Error] => [
            index,
            linkingError,
          ]),
        );
      } else {
        this.errors.push(error);
      }
    });
  }

  cliFormat() {
    const title =
      chalk.bold('Linking Error.') +
      ' It was not possible to satisfy all the required types dependencies in the SDL:';

    const details = this.errors.map(([_, error]) => formatCLIError(error)).join('\n\n');

    return (
      wrap(title, { width: 94, indent: '' }) +
      '\n\n' +
      wrap(details, { width: 90, indent: '    ' }) +
      '\n'
    );
  }
}

export class DuplicateFieldError extends ExtendableError implements FormattableError {
  existingResolution: ResolutionDescription;
  name: string;
  filePath: string;
  elementKind: ElementKind;

  constructor(
    existingResolution: ResolutionDescription,
    name: string,
    filePath: string,
    elementKind: ElementKind,
  ) {
    super('Duplicate error found');

    this.existingResolution = existingResolution;
    this.name = name;
    this.filePath = filePath;
    this.elementKind = elementKind;
  }

  cliFormat() {
    return '';
  }
}

export class EmptyLoadersFileError extends ExtendableError implements FormattableError {
  filePath: string;

  constructor(filePath: string) {
    super(`Loader file for ${filePath} would be empty.`);

    this.filePath = filePath;
  }

  cliFormat() {
    return `No loaders to generate in loaders file for ${this.filePath}. Add at least one ID type field to a type declaration within the file.`;
  }
}

export class NoFieldsTypeError extends ExtendableError implements FormattableError {
  typeDescriptor: ObjectTypeDescriptor;

  constructor(typeDescriptor: ObjectTypeDescriptor) {
    super(`Object type ${typeDescriptor} has no fields.`);

    this.typeDescriptor = typeDescriptor;
  }

  cliFormat() {
    const title = chalk.red(`${this.typeDescriptor.name} has no fields`);

    const help = `\nObject type ${
      this.typeDescriptor.name
    } has no fields. Did you forget to ${chalk.blue('extend')} it or an ${chalk.gray(
      '# import',
    )} statement?`;

    return title + help;
  }
}

export class NoMembersError extends ExtendableError implements FormattableError {
  descriptor: EnumTypeDescriptor | UnionTypeDescriptor;

  constructor(descriptor: EnumTypeDescriptor | UnionTypeDescriptor) {
    super(`${descriptor} has no members.`);

    this.descriptor = descriptor;
  }

  cliFormat() {
    const title = chalk.red(`${this.descriptor.name} has no members`);
    const type = this.descriptor.kind === 'EnumTypeDescriptor' ? 'Enum' : 'Union';

    const help = `\n${type} ${this.descriptor.name} has no fields. Did you forget to ${chalk.blue(
      'extend',
    )} it or an ${chalk.gray('# import')} statement?`;

    return title + help;
  }
}
