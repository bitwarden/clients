/**
 * Mirrors the Rust `agent_access::CredentialQueryType` const enum (see
 * `apps/desktop/desktop_native/napi/index.d.ts`). That type is declared `const enum` in an
 * ambient `.d.ts` with no runtime JS object backing it, so the string literals are duplicated
 * here for use in TS/Angular code (comparisons, display copy, template bindings). Keep the values
 * in sync with the napi contract.
 */
export const CredentialQueryType = Object.freeze({
  Domain: "domain",
  Id: "id",
  Search: "search",
  /**
   * Exact (or unique case-insensitive) Secrets Manager secret key match. Valid only for
   * `resourceType: "secret"` requests.
   */
  Name: "name",
} as const);
export type CredentialQueryType = (typeof CredentialQueryType)[keyof typeof CredentialQueryType];
