const path = require('path');

module.exports = {
  rootDir: process.cwd(),
  roots: ['<rootDir>/packages', '<rootDir>/scripts'],
  testRegex: '/__tests__/[^/]*(\\.js|[^d]\\.ts)$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsConfig: path.join(process.cwd(), 'tsconfig.json'),
    },
  },
};
