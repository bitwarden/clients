import { AutofillInit } from "./content/abstractions/autofill-init";

declare global {
  interface Window {
    bitwardenAutofillInit?: AutofillInit;
  }

  namespace NodeJS {
    interface ProcessEnv {
      BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS?: string;
    }
  }
}
