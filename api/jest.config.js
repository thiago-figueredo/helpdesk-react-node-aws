/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  maxWorkers: 1,
  setupFiles: ["<rootDir>/test/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/matchers.ts"],
  moduleNameMapper: {
    "^@yourname/helpdesk-shared$": "<rootDir>/../shared/src/index.ts",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
};
