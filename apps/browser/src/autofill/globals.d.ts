import { AutofillInit } from "./content/abstractions/autofill-init";

declare global {
  interface Window {
    bitwardenAutofillInit?: AutofillInit;
  }
}
