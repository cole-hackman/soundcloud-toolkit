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

      // These four were downgraded to "warn" at the start of
      // feat/trust-and-mobile (18 / 12 / 11 / 3 violations) so the branch
      // could see the baseline while it worked through it. At the end of the
      // branch the counts are 0 / 0 / 1 / 2, the three survivors are stated
      // as `eslint-disable-next-line` at their call sites with the reason
      // written beside them (GlareHover's decorative pointer gloss, the
      // desktop rail's hover-peek which has a focus equivalent, and
      // SelectableRow's `<label>` bound to a real checkbox), and all four
      // rules are back at "error".
      //
      // Anything new that trips them is a build failure, which is the point:
      // a "warn" that nobody is counting down is indistinguishable from the
      // rule being off. If one has to go back to "warn", put the count beside
      // it again — an uncounted "warn" regresses silently.
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error"
    },
  },
];

export default eslintConfig;
