import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextCoreWebVitals.map((config) =>
    config.name === "next"
      ? {
          ...config,
          rules: {
            ...(config.rules ?? {}),
            // These React compiler-era rules surface as new errors across unchanged pages;
            // keep the repository's existing warning-only lint baseline until those pages
            // are migrated in dedicated follow-up work.
            "react-hooks/immutability": "off",
            "react-hooks/purity": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/static-components": "off",
          },
        }
      : config.name === "next/typescript"
      ? {
          ...config,
          rules: {
            ...(config.rules ?? {}),
            // Pre-existing code uses `any` types throughout; maintain prior behaviour
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "warn",
          },
        }
      : config,
  ),
]);

export default eslintConfig;
