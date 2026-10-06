import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * Shared ESLint flat config for Node.js services (Express API, BullMQ worker).
 *
 * ESLint 9 uses "flat config" (an eslint.config.js that default-exports an array
 * of config objects) and no longer reads the old `.eslintrc.cjs` format by
 * default. This replaces the previous `@repo/eslint-config/node.js` eslintrc
 * export that apps/api and apps/worker used to `extends`.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
