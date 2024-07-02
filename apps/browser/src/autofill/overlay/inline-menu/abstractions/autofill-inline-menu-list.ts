import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";

type AutofillInlineMenuListMessage = { command: string };

export type UpdateAutofillInlineMenuListCiphersMessage = AutofillInlineMenuListMessage & {
  ciphers: InlineMenuCipherData[];
  showLoginAccountCreation?: boolean;
};

export type InitAutofillInlineMenuListMessage = AutofillInlineMenuListMessage & {
  authStatus: AuthenticationStatus;
  styleSheetUrl: string;
  theme: string;
  translations: Record<string, string>;
  ciphers?: InlineMenuCipherData[];
  filledByCipherType?: CipherType;
  showLoginAccountCreation?: boolean;
  portKey: string;
};

export type AutofillInlineMenuListWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillInlineMenuList: ({ message }: { message: InitAutofillInlineMenuListMessage }) => void;
  checkAutofillInlineMenuListFocused: () => void;
  updateAutofillInlineMenuListCiphers: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuListCiphersMessage;
  }) => void;
  focusAutofillInlineMenuList: () => void;
};
