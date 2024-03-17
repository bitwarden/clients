const AutofillOverlayElement = {
  Button: "autofill-overlay-button",
  List: "autofill-overlay-list",
} as const;

const AutofillOverlayPort = {
  Button: "autofill-overlay-button-port",
  List: "autofill-overlay-list-port",
} as const;

const RedirectFocusDirection = {
  Current: "current",
  Previous: "previous",
  Next: "next",
} as const;

export { AutofillOverlayElement, AutofillOverlayPort, RedirectFocusDirection };
