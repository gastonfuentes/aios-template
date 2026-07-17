import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",
    "public/sw.js",
    "scripts/**",
  ]),
  // Vendored registry: shadcn primitives + AI Elements (Vercel registry).
  // Estos archivos son copy-paste de registries externos y se re-instalan via
  // `npx shadcn@latest add ...` / `npx ai-elements@latest`. Sus patrones de
  // react-hooks no cumplen las reglas stricter Praxis del shell (PRP-003 /
  // PRP-005 / PRP-012 / PRP-020), pero funcionan correctamente en runtime y
  // tocarlos a mano expone a drift al re-install. Relajamos las reglas que
  // solo aplican al código del shell.
  {
    files: [
      "src/core/ui/**/*.{ts,tsx}",
      "src/components/ai-elements/**/*.{ts,tsx}",
    ],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/static-components": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/globals": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/use-memo": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-img-element": "off",
      "jsx-a11y/role-has-required-aria-props": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/alt-text": "off",
    },
  },
]);

export default eslintConfig;
