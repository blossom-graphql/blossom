/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';

import chalk from 'chalk';

import { listDirFilesRecursive } from '../../lib/utils';
import { appPath } from '../../lib/paths';

export type ActionDescriptor = {
  description: string;
  dryDescription: string;
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
    description: chalk.blue.bold('Updating package.json file'),
    dryDescription: `add the following dependencies to package.json:\n${printPackageList(
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
    description: chalk.blue.bold('Copying template files'),
    dryDescription: `copy the following files in your project:\n${fileList}`,
    perform: async () => {},
  };
}

export function shouldUseYarn(): boolean {
  try {
    execSync('yarnpkg --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    // Something went wrong, we can't use yarn.
    return false;
  }
}

export async function installDependencies(
  useNpm: boolean = false,
): Promise<ActionDescriptor> {
  const useYarn = useNpm ? false : shouldUseYarn();
  const pkgManager = useYarn ? 'yarn' : 'npm install';

  return {
    description: chalk.blue.bold(`Installing dependencies (${pkgManager})`),
    dryDescription: `install dependencies (${pkgManager})`,
    perform: () => {
      return new Promise((resolve, reject) => {
        const cwd = appPath('.');

        let childProcess: ChildProcess;
        if (useYarn) {
          childProcess = spawn('yarn', [], { stdio: 'inherit', cwd });
        } else {
          childProcess = spawn('npm', ['install'], { stdio: 'inherit', cwd });
        }

        childProcess.on('close', code => {
          if (code !== 0) {
            reject(new Error(`Program exited with code ${code}.`));
            return;
          }
          resolve();
        });
      });
    },
  };
}
