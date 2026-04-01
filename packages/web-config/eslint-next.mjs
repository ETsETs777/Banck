import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

/** @param {string} importMetaUrl */
export function createNextEslintConfig(importMetaUrl) {
  const baseDirectory = dirname(fileURLToPath(importMetaUrl));
  const compat = new FlatCompat({ baseDirectory });
  return [...compat.extends("next/core-web-vitals", "next/typescript")];
}
