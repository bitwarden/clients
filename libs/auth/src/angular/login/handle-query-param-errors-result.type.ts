// eslint-disable-next-line no-restricted-imports
import { AnonLayoutWrapperData } from "@bitwarden/components";

/**
 * Result of `LoginComponentService.handleQueryParamErrors`.
 *
 * - `auto-submit`: advance the user to MP entry with a variant-specific
 *   anon-layout override.
 * - `redirected`: the handler navigated away from /login; the caller should
 *   stop running its own init.
 * - `none`: nothing to do (unrecognized code, missing required params, or a
 *   side-effect-only branch that keeps the user on /login).
 */
export type HandleQueryParamErrorsResult =
  | { kind: "auto-submit"; mpEntryLayoutOverride: Partial<AnonLayoutWrapperData> }
  | { kind: "redirected" }
  | { kind: "none" };
