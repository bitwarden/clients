import { bootstrapAutofillOverlay } from "./bootstrap-autofill-overlay-shared";

bootstrapAutofillOverlay(
  window,
  { inlineMenu: false, notifications: true },
  "content-script-notifications",
);
