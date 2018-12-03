/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { BlossomInstance } from '../instance';
import { RootValueAlreadyInUse } from '../errors';

const createInstance: () => BlossomInstance = () => {
  return new BlossomInstance();
};

describe('BlossomInstance', () => {
  describe('registerSchema', () => {
    it('should add a new schema to the schema list', () => {
      const TEST_SCHEMA_1 = 'type Test1 {}';
      const TEST_SCHEMA_2 = 'type Test2 {}';

      const instance = createInstance();

      // Add test schemas
      instance.registerSchema(TEST_SCHEMA_1);
      instance.registerSchema(TEST_SCHEMA_2);

      // This newly added schema must be on the schemas list.
      expect(instance.schemas).toContain(TEST_SCHEMA_1);
      expect(instance.schemas).toContain(TEST_SCHEMA_2);
    });
  });

  describe('registerEnum', () => {
    it('should add a new enum to the schema list', () => {
      const TEST_ENUM_1 = {
        name: 'TestEnum1',
        values: [{ name: 'foo' }, { name: 'bar' }],
      };

      const TEST_ENUM_2 = {
        name: 'TestEnum2',
        values: [{ name: 'test' }],
      };

      const instance = createInstance();

      instance.registerEnum(TEST_ENUM_1);
      instance.registerEnum(TEST_ENUM_2);

      expect(instance.enums).toContain(TEST_ENUM_1);
      expect(instance.enums).toContain(TEST_ENUM_2);
    });
  });

  describe('registerRootQuery', () => {
    it('should properly register the rpc description on the list of root queries', () => {
      const RPC_DESCRIPTION_1 = {
        name: 'testRootQuery1',
        type: 'TestType',
        callback: () => null,
      };

      const RPC_DESCRIPTION_2 = {
        name: 'testRootQuery2',
        type: 'TestType',
        callback: () => null,
      };

      const instance = createInstance();

      instance.registerRootQuery(RPC_DESCRIPTION_1);
      instance.registerRootQuery(RPC_DESCRIPTION_2);

      expect(instance.rootQueries).toContain(RPC_DESCRIPTION_1);
      expect(instance.rootQueries).toContain(RPC_DESCRIPTION_2);
    });

    it('should throw error when query with the same name is already registered', () => {
      const RPC_DESCRIPTION = {
        name: 'testRootQuery',
        type: 'TestType',
        callback: () => null,
      };

      const instance = createInstance();

      instance.registerRootQuery(RPC_DESCRIPTION);

      // Registering the same name again must throw an error.
      expect(() => instance.registerRootQuery(RPC_DESCRIPTION)).toThrow(
        RootValueAlreadyInUse,
      );
    });
  });

  describe('registerRootMutation', () => {
    it('should properly register the rpc description on the list of root queries', () => {
      const RPC_DESCRIPTION_1 = {
        name: 'testRootMutation1',
        type: 'TestType',
        callback: () => null,
      };

      const RPC_DESCRIPTION_2 = {
        name: 'testRootMutation2',
        type: 'TestType',
        callback: () => null,
      };

      const instance = createInstance();

      instance.registerRootMutation(RPC_DESCRIPTION_1);
      instance.registerRootMutation(RPC_DESCRIPTION_2);

      expect(instance.rootMutations).toContain(RPC_DESCRIPTION_1);
      expect(instance.rootMutations).toContain(RPC_DESCRIPTION_2);
    });

    it('should throw error when query with the same name is already registered', () => {
      const RPC_DESCRIPTION = {
        name: 'testRootMutation',
        type: 'TestType',
        callback: () => null,
      };

      const instance = createInstance();

      instance.registerRootMutation(RPC_DESCRIPTION);

      // Registering the same name again must throw an error.
      expect(() => instance.registerRootMutation(RPC_DESCRIPTION)).toThrow(
        RootValueAlreadyInUse,
      );
    });
  });
});
