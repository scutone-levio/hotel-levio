import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import prettier from "eslint-config-prettier"
import sonarjs from "eslint-plugin-sonarjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  sonarjs.configs.recommended,
  {
    rules: {
      "react/jsx-child-element-spacing": "error",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "sonarjs/no-hardcoded-passwords": "off",
    },
  },
  {
    files: ["scripts/**"],
    rules: {
      "sonarjs/no-os-command-from-path": "off",
    },
  },
  // Turn off ESLint rules that conflict with Prettier. Keep this last.
  prettier,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
]

export default eslintConfig
