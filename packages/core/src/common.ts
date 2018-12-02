/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Maybe the expected value, otherwise null or undefined.
 */
export type Maybe<T> = T | null | undefined;

/**
 * A promise that resolves to Maybe<T>.
 */
export type MaybePromise<T> = Promise<Maybe<T>>;
