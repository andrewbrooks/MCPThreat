import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...coreWebVitals,
  ...typescript,
  globalIgnores(["demo/**", ".next/**", "node_modules/**", "next-env.d.ts"]),
]);
