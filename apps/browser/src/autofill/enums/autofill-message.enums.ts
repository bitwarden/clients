export const AutofillMessageCommand = {
  collectPageDetails: "collectPageDetails",
  collectPageDetailsResponse: "collectPageDetailsResponse",
  pageTransitionDetected: "pageTransitionDetected",
} as const;

export type AutofillMessageCommandType =
  (typeof AutofillMessageCommand)[keyof typeof AutofillMessageCommand];

export const AutofillMessageSender = {
  collectPageDetailsFromTabObservable: "collectPageDetailsFromTabObservable",
} as const;

export type AutofillMessageSenderType =
  (typeof AutofillMessageSender)[keyof typeof AutofillMessageSender];

export const AutofillLifecycleCommand = Object.freeze({
  start: "startAutofillMonitors",
  stop: "stopAutofillMonitors",
} as const);

export type AutofillLifecycleCommand =
  (typeof AutofillLifecycleCommand)[keyof typeof AutofillLifecycleCommand];

export const AutofillerCommand = Object.freeze({
  disable: "disableAutofiller",
} as const);

export type AutofillerCommand = (typeof AutofillerCommand)[keyof typeof AutofillerCommand];
