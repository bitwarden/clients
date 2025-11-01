import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";

type ContentMessageWindowData = {
  command: string;
  lastpass?: boolean;
  code?: string;
  state?: string;
  data?: string;
  remember?: boolean;
  url?: ExtensionPageUrls;
};
type ContentMessageWindowEventParams = {
  data: ContentMessageWindowData;
  referrer: string;
};

type ContentMessageWindowEventHandlers = {
  [key: string]: ({ data, referrer }: ContentMessageWindowEventParams) => void;
  authResult: ({ data, referrer }: ContentMessageWindowEventParams) => void;
  webAuthnResult: ({ data, referrer }: ContentMessageWindowEventParams) => void;
  duoResult: ({ data, referrer }: ContentMessageWindowEventParams) => void;
  checkIfBWExtensionInstalled: () => void;
};

export {
  ContentMessageWindowData,
  ContentMessageWindowEventParams,
  ContentMessageWindowEventHandlers,
};
