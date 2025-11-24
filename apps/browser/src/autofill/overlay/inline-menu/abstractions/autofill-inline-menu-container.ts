import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";

export type AutofillInlineMenuContainerMessage = {
  command: string;
  portKey: string;
  token?: string;
};

export type InitAutofillInlineMenuElementMessage = AutofillInlineMenuContainerMessage & {
  iframeUrl: string;
  pageTitle: string;
  authStatus: AuthenticationStatus;
  styleSheetUrl: string;
  theme: string;
  translations: Record<string, string>;
  ciphers: InlineMenuCipherData[] | null;
  portName: string;
  extensionOrigin?: string;
};

export type AutofillInlineMenuContainerWindowMessage = AutofillInlineMenuContainerMessage &
  Record<string, unknown>;

export type AutofillInlineMenuContainerPortMessage = AutofillInlineMenuContainerMessage &
  Record<string, unknown>;

export type AutofillInlineMenuContainerWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillInlineMenuButton: (message: InitAutofillInlineMenuElementMessage) => void;
  initAutofillInlineMenuList: (message: InitAutofillInlineMenuElementMessage) => void;
};
