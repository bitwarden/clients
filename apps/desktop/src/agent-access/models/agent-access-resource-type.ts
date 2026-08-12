/**
 * Mirrors the Rust `agent_access::ResourceType` const enum (see
 * `apps/desktop/desktop_native/napi/index.d.ts`). That type is declared `const enum` in an
 * ambient `.d.ts` with no runtime JS object backing it, so the string literals are duplicated
 * here for use in TS/Angular code (comparisons, display copy, template bindings). Keep the values
 * in sync with the napi contract.
 */
export const AgentAccessResourceType = Object.freeze({
  Credential: "credential",
  Secret: "secret",
} as const);
export type AgentAccessResourceType =
  (typeof AgentAccessResourceType)[keyof typeof AgentAccessResourceType];
