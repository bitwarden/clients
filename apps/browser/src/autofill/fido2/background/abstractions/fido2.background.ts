import {
  AssertCredentialParams,
  AssertCredentialResult,
  CreateCredentialParams,
  CreateCredentialResult,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

type SharedFido2ScriptInjectionDetails = {
  runAt: browser.contentScripts.RegisteredContentScriptOptions["runAt"];
};

type SharedFido2ScriptRegistrationOptions = SharedFido2ScriptInjectionDetails & {
  matches: string[];
  excludeMatches: string[];
  allFrames: true;
  world?: "MAIN" | "ISOLATED";
};

type Fido2ExtensionMessage = {
  [key: string]: any;
  command: string;
  hostname?: string;
  origin?: string;
  requestId?: string;
  abortedRequestId?: string;
  data?: AssertCredentialParams | CreateCredentialParams;
};

type Fido2ExtensionMessageEventParams = {
  message: Fido2ExtensionMessage;
  sender: chrome.runtime.MessageSender;
};

type Fido2BackgroundExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  fido2AbortRequest: ({ message }: Fido2ExtensionMessageEventParams) => void;
  fido2RegisterCredentialRequest: ({
    message,
    sender,
  }: Fido2ExtensionMessageEventParams) => Promise<CreateCredentialResult>;
  fido2GetCredentialRequest: ({
    message,
    sender,
  }: Fido2ExtensionMessageEventParams) => Promise<AssertCredentialResult>;
};

interface Fido2Background {
  init(): void;
}

export {
  SharedFido2ScriptInjectionDetails,
  SharedFido2ScriptRegistrationOptions,
  Fido2ExtensionMessage,
  Fido2BackgroundExtensionMessageHandlers,
  Fido2Background,
};
