import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextTs,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    }
  },
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "**/*.d.ts",
  ]),
]);

export default eslintConfig;
