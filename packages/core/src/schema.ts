/**
 * Value descriptor of an enumeration.
 */
export interface IEnumValue {
  /**
   * Name and value.
   */
  name: string;
  /**
   * Description, in the schema.
   */
  description?: string;
}

/**
 * Descriptor of a full enumeration in the schema.
 */
export interface IEnum {
  /**
   * Name of the enumeration.
   */
  name: string;
  /**
   * Description for the schema.
   */
  description?: string;
  /**
   * List of possible value descriptors the enum
   * can take.
   */
  values: IEnumValue[];
}

/**
 * A single argument descriptor of a RPC call.
 */
export interface IRPCArgument {
  /**
   * Programatical name to be displayed.
   */
  name: string;
  /**
   * Description, for comments and schema info, regarding
   * this parameter.
   */
  description?: string;
  /**
   * Expected type for this parameter.
   */
  type: string;
}

/**
 * Base descriptor with the simplest elements.
 */
export interface IRPCDescriptionBase {
  /**
   * Name that this callback will have over the
   * root query.
   */
  name: string;
  /**
   * Full description of the operation in the comments.
   */
  description?: string;
  /**
   * List of arguments this callback will receive. Will render
   * nothing if none is provided.
   */
  arguments?: IRPCArgument[];
  /**
   * The type this callback will be returning.
   */
  type: string;
}

/**
 * The signature of a callback function.
 */
export type RPCCallback<U> = (args?: any, ctx?: any, ast?: any) => U;

/**
 * A descriptor of a RPC action, i.e. a query or a mutation.
 */
export type RPCDescription = IRPCDescriptionBase & {
  /**
   * The function that resolves this RPC value.
   */
  callback: RPCCallback<any>;
};

/**
 * Receives a GraphQL enum descriptor and converts it to a string which can
 * be used to work on.
 *
 * @param enumDescription The descriptor of the enum to be converted.
 */
export function renderEnumToSchema({
  name,
  description,
  values,
}: IEnum): string {
  const valuesStrings = values.map(
    ({ name, description }) =>
      `  """\n  ${description || ''}\n  """\n  ${name}`,
  );

  return `"""\n${description || ''}\n"""\nenum ${name} {\n${valuesStrings.join(
    '\n',
  )}\n}`;
}

/**
 * Converts the RPC descriptor into a string that can be used on the whole
 * schema.
 *
 * @param rpcDescription Descriptor of the remote procedure call.
 */
export function renderRPCDescriptionToSchema(
  rpcDescription: RPCDescription,
): string {
  const convertedArguments = rpcDescription.arguments
    ? rpcDescription.arguments.map(
        argument =>
          `    """\n    ${argument.description || ''}\n    """\n    ${
            argument.name
          }: ${argument.type}`,
      )
    : [];
  const argumentsText =
    convertedArguments.length > 0
      ? `(\n${convertedArguments.join('\n')}\n  )`
      : '';

  return `  """\n  ${rpcDescription.description || ''}\n  """\n  ${
    rpcDescription.name
  }${argumentsText}: ${rpcDescription.type}`;
}

/**
 * Receives arrays with consolidated enums, schemas, rootQueries and mutations
 * and consolidates them on a single schema string which then can be passed
 * down to GraphQL.JS buildSchema() method.
 *
 * @param enumsStrings List of enum schema declarations to be included.
 * @param schemasStrings List of schema strings with type definitions.
 * @param rootQueries List of schema strings with query RPC definitions.
 * @param rootMutations List of scheam strings with mutation RPC definitions.
 */
export function renderSchema(
  enumsStrings: string[],
  schemasStrings: string[],
  rootQueries: string[],
  rootMutations: string[],
): string {
  const rootQueriesStrings =
    rootQueries.length > 0
      ? [`type Query {\n${rootQueries.join('\n')}\n}`]
      : [];
  const rootMutationsStrings =
    rootMutations.length > 0
      ? [`type Mutation {\n${rootMutations.join('\n')}\n}`]
      : [];

  // Definition strings
  const queryDefinitionString =
    rootQueriesStrings.length > 0 ? '\n  query: Query' : ``;
  const mutationDefinitionString =
    rootMutationsStrings.length > 0 ? '\n  mutation: Mutation' : ``;

  // Stitch them together, but only when
  const rootSchemaString =
    queryDefinitionString || mutationDefinitionString
      ? [`schema {${queryDefinitionString}${mutationDefinitionString}\n}`]
      : [];

  // The array of all we are taking together.
  const chunks = [
    ...enumsStrings,
    ...schemasStrings,
    ...rootQueriesStrings,
    ...rootMutationsStrings,
    ...rootSchemaString,
  ];

  return chunks.filter(chunk => !!chunk).join('\n\n');
}
