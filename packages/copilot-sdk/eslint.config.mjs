import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "react-compiler/react-compiler": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
    }
  },
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "**/*.d.ts",
  ]),
]);

export default eslintConfig;
