import { AutofillInit } from "./content/abstractions/autofill-init";

declare global {
  interface Window {
    bitwardenAutofillInit?: AutofillInit;
    __BITWARDEN_ENABLE_INSTRUMENTATION__?: boolean;
    __BITWARDEN_USE_TIMEOUT_FLUSH__?: boolean;
  }
}
