/**
 * Copyright (c) The Blossom GraphQL Team.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';

import fsExtra from 'fs-extra';
import { merge } from 'lodash';
import chalk from 'chalk';

import { listDirFilesRecursive } from '../../utils';
import { appPath } from '../../paths';

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

export function addDependencies(packages: DependenciesDescription): ActionDescriptor {
  return {
    description: chalk.blue.bold('Updating package.json file'),
    dryDescription: `add the following dependencies to package.json:\n${printPackageList(
      packages,
    )}`,
    perform: async () => {
      const packagePath = appPath('./package.json');
      const packageContents = await fsExtra.readFile(packagePath);
      const packageJSON = JSON.parse(packageContents.toString('utf-8'));

      // Merge both objects. packages will override whatever version is there.
      // TODO: Maybe warn about this?
      merge(packageJSON, packages);

      await fsExtra.writeFile(packagePath, JSON.stringify(packageJSON, null, 2));
    },
  };
}

export function pathMapper(basePath: string, filePath: string): string {
  if (filePath.endsWith('.DS_Store')) return '';

  const dotFileRegex = '.dotfile$';

  let finalPath = filePath;
  if (new RegExp(dotFileRegex).test(filePath)) {
    finalPath = finalPath.replace(new RegExp(dotFileRegex), '');
  }

  return appPath(path.relative(basePath, finalPath));
}

export async function copyFiles(basePath: string): Promise<ActionDescriptor> {
  const files = (await listDirFilesRecursive(basePath)) as string[];
  const filesMap: { [key: string]: string } = {};

  files.forEach(filePath => {
    filesMap[filePath] = pathMapper(basePath, filePath);
  });

  const fileList = files
    .filter(filePath => filesMap[filePath])
    .map(filePath => `- From: ${filePath}\n  To:   ${filesMap[filePath]}`)
    .join('\n');

  return {
    description: chalk.blue.bold('Copying template files'),
    dryDescription: `copy the following files in your project:\n${fileList}`,
    perform: async () => {
      await Promise.all(
        Object.entries(filesMap).map(async ([origin, destination]) => {
          if (!destination) return;
          const parse = path.parse(destination);

          await fsExtra.ensureDir(parse.dir);
          await fsExtra.copy(origin, destination);
        }),
      );
    },
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

export async function installDependencies(useNpm: boolean = false): Promise<ActionDescriptor> {
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
