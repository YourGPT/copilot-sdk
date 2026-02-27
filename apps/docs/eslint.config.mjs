import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-compiler/react-compiler": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
    }
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "dist/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
