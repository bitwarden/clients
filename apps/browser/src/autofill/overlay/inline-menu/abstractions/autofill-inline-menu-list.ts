import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { InlineMenuFillType } from "../../../enums/autofill-overlay.enum";

type AutofillInlineMenuListMessage = { command: string };

export type UpdateAutofillInlineMenuListCiphersParams = {
  ciphers: InlineMenuCipherData[];
  showInlineMenuAccountCreation?: boolean;
  /**
   * The current substring filter being applied to the cipher list. When non-empty
   * and the resulting `ciphers` array is empty, the list iframe renders a
   * "no matches" empty-state that includes this string.
   */
  filter?: string;
};

export type UpdateAutofillInlineMenuListCiphersMessage = AutofillInlineMenuListMessage &
  UpdateAutofillInlineMenuListCiphersParams;

export type UpdateAutofillInlineMenuGeneratedPasswordMessage = AutofillInlineMenuListMessage & {
  generatedPassword: string;
};

export type InitAutofillInlineMenuListMessage = AutofillInlineMenuListMessage & {
  authStatus: AuthenticationStatus;
  styleSheetUrl: string;
  theme: string;
  translations: Record<string, string>;
  ciphers?: InlineMenuCipherData[];
  inlineMenuFillType?: InlineMenuFillType;
  showInlineMenuAccountCreation?: boolean;
  showPasskeysLabels?: boolean;
  portKey: string;
  token: string;
  generatedPassword?: string;
  showSaveLoginMenu?: boolean;
  showAnimations?: boolean;
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
  updateAutofillInlineMenuGeneratedPassword: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuGeneratedPasswordMessage;
  }) => void;
  focusAutofillInlineMenuList: () => void;
};
