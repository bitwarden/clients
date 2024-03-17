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
  SCROLL: "scroll",
  RESIZE: "resize",
  DOMCONTENTLOADED: "DOMContentLoaded",
  LOAD: "load",
  MESSAGE: "message",
  VISIBILITYCHANGE: "visibilitychange",
  FOCUSOUT: "focusout",
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

/* Context Menu item Ids */
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

export const NOTIFICATION_BAR_LIFESPAN_MS = 150000; // 150 seconds

export const AutofillOverlayVisibility = {
  Off: 0,
  OnButtonClick: 1,
  OnFieldFocus: 2,
} as const;
