/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { parse } from 'graphql';

// Why this way? Because this will generate the correct data structure
// independent of the graphql version. The cost is a small overhead that we
// can remove by moving this to CI when required.
const parsed = parse(`
enum BlossomThunkType {
  none
  function
  async
}

directive @blossomImpl(type: BlossomThunkType!) on FIELD_DEFINITION;

directive @schemaQuery on FIELD_DEFINITION;

directive @schemaMutation on FIELD_DEFINITION;
`);

export default parsed.definitions;
