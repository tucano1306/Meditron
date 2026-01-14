import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Desactivar reglas demasiado estrictas
      "no-negated-condition": "off",
      "unicorn/prefer-number-properties": "off",
      "unicorn/prefer-date-now": "off",
      "jsx-a11y/heading-has-content": "off",
      "react/prefer-read-only-props": "off",
    }
  }
];

export default eslintConfig;
