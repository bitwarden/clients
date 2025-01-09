export const AutofillMessageCommand = {
  collectPageDetails: "collectPageDetails",
  collectPageDetailsResponse: "collectPageDetailsResponse",
} as const;

export type AutofillMessageCommandType =
  (typeof AutofillMessageCommand)[keyof typeof AutofillMessageCommand];

export const AutofillMessageSender = {
  collectPageDetailsFromTabObservable: "collectPageDetailsFromTabObservable",
} as const;

export type AutofillMessageSenderType =
  (typeof AutofillMessageSender)[keyof typeof AutofillMessageSender];
