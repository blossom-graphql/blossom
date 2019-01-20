/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';

import { listDirFilesRecursive } from '../../lib/utils';
import { appPath } from '../../lib/paths';

export type ActionDescriptor = {
  description: string;
  perform: () => Promise<void>;
};

export type DependenciesDescription = {
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
};

export function printPackageList(packages: DependenciesDescription): string {
  const list: string[] = [];

  Object.entries(packages.dependencies).forEach(([name, version]) => {
    list.push(`- ${name}: ${version}`);
  });

  Object.entries(packages.devDependencies).forEach(([name, version]) => {
    list.push(`- [DEV] ${name}: ${version}`);
  });

  return list.join('\n');
}

export function addDependencies(
  packages: DependenciesDescription,
): ActionDescriptor {
  return {
    description: `add the following dependencies to package.json:\n${printPackageList(
      packages,
    )}`,
    perform: async () => {},
  };
}

export async function copyFiles(basePath: string): Promise<ActionDescriptor> {
  const files = (await listDirFilesRecursive(basePath)) as string[];
  const filesMap: any = {};

  files.forEach(filePath => {
    filesMap[filePath] = appPath(path.relative(basePath, filePath));
  });

  const fileList = files
    .map(filePath => `- From: ${filePath}\n  To:   ${filesMap[filePath]}`)
    .join('\n');

  return {
    description: `copy the following files in your project:\n${fileList}`,
    perform: async () => {},
  };
}

export async function installDependencies(): Promise<ActionDescriptor> {
  return {
    description: 'install dependencies (yarn / npm install)',
    perform: async () => {},
  };
}
