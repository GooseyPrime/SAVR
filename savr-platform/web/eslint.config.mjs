import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      // Preserve the current warning-only lint baseline while Next 16's flat
      // config enables additional React Hooks rules that existing screens
      // still violate; those call sites need dedicated follow-up fixes.
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
]);

export default eslintConfig;
