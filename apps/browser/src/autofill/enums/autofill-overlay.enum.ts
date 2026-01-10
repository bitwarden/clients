import { CipherType } from "@bitwarden/common/vault/enums";

export const AutofillOverlayElement = {
  Button: "autofill-inline-menu-button",
  List: "autofill-inline-menu-list",
} as const;

export type AutofillOverlayElementType =
  (typeof AutofillOverlayElement)[keyof typeof AutofillOverlayElement];

export const AutofillOverlayPort = {
  Button: "autofill-inline-menu-button-port",
  ButtonMessageConnector: "autofill-inline-menu-button-message-connector",
  List: "autofill-inline-menu-list-port",
  ListMessageConnector: "autofill-inline-menu-list-message-connector",
} as const;

export const RedirectFocusDirection = {
  Current: "current",
  Previous: "previous",
  Next: "next",
} as const;

export const InlineMenuFillTypes = {
  AccountCreationUsername: 5,
  PasswordGeneration: 6,
  CurrentPasswordUpdate: 7,
} as const;

export type InlineMenuFillTypeValue =
  (typeof InlineMenuFillTypes)[keyof typeof InlineMenuFillTypes];

export type InlineMenuFillType = InlineMenuFillTypeValue | CipherType;

export const InlineMenuAccountCreationFieldType = {
  Text: "text",
  Email: "email",
  Password: "password",
  Totp: "totp",
} as const;

export type InlineMenuAccountCreationFieldTypes =
  (typeof InlineMenuAccountCreationFieldType)[keyof typeof InlineMenuAccountCreationFieldType];

export const MAX_SUB_FRAME_DEPTH = 8;
