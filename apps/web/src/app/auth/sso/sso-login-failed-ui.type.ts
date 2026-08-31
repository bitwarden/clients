import { AnonLayoutWrapperData, Translation } from "@bitwarden/components";

/**
 * Descriptor rendered by `SsoLoginFailedComponent` for a given error kind.
 * `anonLayoutData` drives the page chrome; `bodyMessage` is a translation
 * with per-variant placeholders resolved from the route query params.
 */
export interface SsoLoginFailedUi {
  anonLayoutData: AnonLayoutWrapperData;
  bodyMessage: Translation;
}
