import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

type OverlayButtonMessage = { command: string; colorScheme?: string };

type UpdateAuthStatusMessage = OverlayButtonMessage & { authStatus: AuthenticationStatus };

type InitAutofillOverlayButtonMessage = UpdateAuthStatusMessage & {
  styleSheetUrl: string;
  translations: Record<string, string>;
};

type OverlayButtonWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillOverlayButton: ({ message }: { message: InitAutofillOverlayButtonMessage }) => void;
  checkAutofillOverlayButtonFocused: () => void;
  updateAutofillOverlayButtonAuthStatus: ({
    message,
  }: {
    message: UpdateAuthStatusMessage;
  }) => void;
  updateOverlayPageColorScheme: ({ message }: { message: OverlayButtonMessage }) => void;
};

export {
  UpdateAuthStatusMessage,
  OverlayButtonMessage,
  InitAutofillOverlayButtonMessage,
  OverlayButtonWindowMessageHandlers,
};
