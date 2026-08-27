export type AutoSubmitLoginMessage = {
  command: string;
};

export type AutoSubmitLoginMessageParams = {
  message: AutoSubmitLoginMessage;
  sender: chrome.runtime.MessageSender;
};

export type AutoSubmitLoginBackgroundExtensionMessageHandlers = {
  [key: string]: ({ message, sender }: AutoSubmitLoginMessageParams) => any;
  automatedLoginStepReady: ({ sender }: AutoSubmitLoginMessageParams) => void;
  multiStepAutoSubmitLoginComplete: ({ sender }: AutoSubmitLoginMessageParams) => void;
};

export abstract class AutoSubmitLoginBackground {
  abstract init(): void;
}
