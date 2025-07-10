export const TYPE_CHECK = {
  FUNCTION: "function",
  NUMBER: "number",
  STRING: "string",
} as const;

export const EVENTS = {
  CHANGE: "change",
  INPUT: "input",
  KEYDOWN: "keydown",
  KEYPRESS: "keypress",
  KEYUP: "keyup",
  BLUR: "blur",
  CLICK: "click",
  FOCUS: "focus",
  FOCUSIN: "focusin",
  FOCUSOUT: "focusout",
  SCROLL: "scroll",
  RESIZE: "resize",
  DOMCONTENTLOADED: "DOMContentLoaded",
  LOAD: "load",
  MESSAGE: "message",
  VISIBILITYCHANGE: "visibilitychange",
  MOUSEENTER: "mouseenter",
  MOUSELEAVE: "mouseleave",
  MOUSEUP: "mouseup",
  MOUSEOUT: "mouseout",
  SUBMIT: "submit",
} as const;

export const ClearClipboardDelay = {
  Never: null as null,
  TenSeconds: 10,
  TwentySeconds: 20,
  ThirtySeconds: 30,
  OneMinute: 60,
  TwoMinutes: 120,
  FiveMinutes: 300,
} as const;

/* Ids for context menu items and messaging events */
export const AUTOFILL_CARD_ID = "autofill-card";
export const AUTOFILL_ID = "autofill";
export const SHOW_AUTOFILL_BUTTON = "show-autofill-button";
export const AUTOFILL_IDENTITY_ID = "autofill-identity";
export const COPY_IDENTIFIER_ID = "copy-identifier";
export const COPY_PASSWORD_ID = "copy-password";
export const COPY_USERNAME_ID = "copy-username";
export const COPY_VERIFICATION_CODE_ID = "copy-totp";
export const CREATE_CARD_ID = "create-card";
export const CREATE_IDENTITY_ID = "create-identity";
export const CREATE_LOGIN_ID = "create-login";
export const GENERATE_PASSWORD_ID = "generate-password";
export const NOOP_COMMAND_SUFFIX = "noop";
export const ROOT_ID = "root";
export const SEPARATOR_ID = "separator";
export const UPDATE_PASSWORD = "update-password";

export const NOTIFICATION_BAR_LIFESPAN_MS = 150000; // 150 seconds

export const AUTOFILL_OVERLAY_HANDLE_REPOSITION = "autofill-overlay-handle-reposition-event";

export const AUTOFILL_OVERLAY_HANDLE_SCROLL = "autofill-overlay-handle-scroll-event";

export const UPDATE_PASSKEYS_HEADINGS_ON_SCROLL = "update-passkeys-headings-on-scroll";

export const AUTOFILL_TRIGGER_FORM_FIELD_SUBMIT = "autofill-trigger-form-field-submit";

export const AutofillOverlayVisibility = {
  Off: 0,
  OnButtonClick: 1,
  OnFieldFocus: 2,
} as const;

export const BrowserClientVendors = {
  Chrome: "Chrome",
  Opera: "Opera",
  Edge: "Edge",
  Vivaldi: "Vivaldi",
  Unknown: "Unknown",
} as const;

export const BrowserShortcutsUris = {
  Chrome: "chrome://extensions/shortcuts",
  Opera: "opera://extensions/shortcuts",
  Edge: "edge://extensions/shortcuts",
  Vivaldi: "vivaldi://extensions/shortcuts",
  Unknown: "https://bitwarden.com/help/keyboard-shortcuts",
} as const;

export const DisablePasswordManagerUris = {
  Chrome: "chrome://settings/autofill",
  Opera: "opera://settings/autofill",
  Edge: "edge://settings/passwords",
  Vivaldi: "vivaldi://settings/autofill",
  Unknown: "https://bitwarden.com/help/disable-browser-autofill/",
} as const;

export const ExtensionCommand = {
  AutofillCommand: "autofill_cmd",
  AutofillCard: "autofill_card",
  AutofillIdentity: "autofill_identity",
  AutofillLogin: "autofill_login",
  OpenAutofillOverlay: "open_autofill_overlay",
  GeneratePassword: "generate_password",
  OpenPopup: "open_popup",
  LockVault: "lock_vault",
  NoopCommand: "noop",
} as const;

export type ExtensionCommandType = (typeof ExtensionCommand)[keyof typeof ExtensionCommand];

export const CLEAR_NOTIFICATION_LOGIN_DATA_DURATION = 60 * 1000; // 1 minute

export const MAX_DEEP_QUERY_RECURSION_DEPTH = 4;

export * from "./match-patterns";
