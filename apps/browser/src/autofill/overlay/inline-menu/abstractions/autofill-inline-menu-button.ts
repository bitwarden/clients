import { AuthenticationStatusValue } from "@bitwarden/common/auth/enums/authentication-status";

export type AutofillInlineMenuButtonMessage = { command: string; colorScheme?: string };

export type UpdateAuthStatusMessage = AutofillInlineMenuButtonMessage & {
  authStatus: AuthenticationStatusValue;
};

export type InitAutofillInlineMenuButtonMessage = UpdateAuthStatusMessage & {
  styleSheetUrl: string;
  translations: Record<string, string>;
  portKey: string;
};

export type AutofillInlineMenuButtonWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillInlineMenuButton: ({
    message,
  }: {
    message: InitAutofillInlineMenuButtonMessage;
  }) => void;
  checkAutofillInlineMenuButtonFocused: () => void;
  updateAutofillInlineMenuButtonAuthStatus: ({
    message,
  }: {
    message: UpdateAuthStatusMessage;
  }) => void;
  updateAutofillInlineMenuColorScheme: ({
    message,
  }: {
    message: AutofillInlineMenuButtonMessage;
  }) => void;
};
