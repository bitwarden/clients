import { bootstrapAutofillOverlay } from "./bootstrap-autofill-overlay-shared";

bootstrapAutofillOverlay(window, { inlineMenu: true, notifications: true }, "content-script");
