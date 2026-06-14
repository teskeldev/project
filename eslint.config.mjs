import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import securityPlugin from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  securityPlugin.configs.recommended,
  {
    rules: {
      // Data-loading in useEffect with async setState is the standard pattern
      // for client components that fetch on mount. This rule flags it
      // incorrectly for our use case.
      "react-hooks/set-state-in-effect": "off",

      // Silence very noisy security false-positives that are expected patterns:
      // - detect-object-injection: flags standard object key lookup (e.g. Map/Record access).
      // - detect-non-literal-fs-filename: flags variable filesystem paths which are required
      //   by our storage layer (secured via resolveSafe/normalizeRelPath).
      // - detect-non-literal-regexp: flags dynamic regexes (e.g. path match patterns).
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "off",

      // detect-unsafe-regex was ~99% false positives here: all 81 flags were
      // empirically stress-tested for catastrophic backtracking; exactly one
      // was a real ReDoS (fixed in agent-loop.ts parseMalformedParams) and the
      // rest are linear. The rule cannot see that e.g. `(?:-\S+\s+)*` is safe
      // because \S/\s are disjoint, so it just creates alert fatigue. Disabled;
      // new code parsers should be checked with the ReDoS harness instead (see
      // the audit notes / tests/load + the scaling-test methodology).
      "security/detect-unsafe-regex": "off",

      // Standard convention: a leading underscore marks an intentionally-unused
      // binding (params kept for signature/interface consistency, ignored
      // destructured fields, caught errors). Genuinely-dead vars are still flagged.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference code (not part of this project):
    "reference/**",
    // k6 load scripts target the k6 runtime (its own globals), not the app.
    "tests/load/**",
  ]),
]);

export default eslintConfig;
