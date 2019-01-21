#!/usr/bin/env node
/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

'use strict';

const path = require('path').join(__dirname, '..', 'dist', 'cmd', 'blossom.js');

require('child_process').spawnSync('node', [path, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
