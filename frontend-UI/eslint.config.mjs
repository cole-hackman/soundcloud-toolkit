import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // `next/core-web-vitals` already registers the "jsx-a11y" plugin itself, so
  // we can't spread jsxA11y.flatConfigs.strict wholesale (it redeclares the
  // "plugins" key and ESLint refuses to redefine a plugin). Its `rules` are
  // what the "strict" preset actually is; merge just those.
  {
    rules: jsxA11y.flatConfigs.strict.rules,
  },
  {
    languageOptions: {
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",

      // jsx-a11y strict-preset baseline (2026-09-22, Task 1 of
      // feat/trust-and-mobile). These rules fire on existing code that this
      // task does not fix; each is downgraded to "warn" with the count of
      // violations at the time it was set, so the baseline stays visible and
      // later phases can turn them back to "error" as they clean up their
      // pages. Do not add a rule here without a count — an uncounted "warn"
      // can silently regress.
      "jsx-a11y/label-has-associated-control": "warn", // 18 at baseline
      "jsx-a11y/click-events-have-key-events": "warn", // 12 at baseline
      "jsx-a11y/no-static-element-interactions": "warn", // 11 at baseline
      "jsx-a11y/no-noninteractive-element-interactions": "warn", // 3 at baseline
    },
  },
];

export default eslintConfig;
