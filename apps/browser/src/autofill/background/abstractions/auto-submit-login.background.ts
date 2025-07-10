import AutofillPageDetails from "../../models/autofill-page-details";

export type AutoSubmitLoginMessage = {
  command: string;
  pageDetails?: AutofillPageDetails;
};

export type AutoSubmitLoginMessageParams = {
  message: AutoSubmitLoginMessage;
  sender: chrome.runtime.MessageSender;
};

export type AutoSubmitLoginBackgroundExtensionMessageHandlers = {
  [key: string]: ({ message, sender }: AutoSubmitLoginMessageParams) => any;
  triggerAutoSubmitLogin: ({ message, sender }: AutoSubmitLoginMessageParams) => Promise<void>;
  multiStepAutoSubmitLoginComplete: ({ sender }: AutoSubmitLoginMessageParams) => void;
};

export abstract class AutoSubmitLoginBackground {
  abstract init(): void;
}
