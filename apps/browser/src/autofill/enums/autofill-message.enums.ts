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

/**
 * Carries the selected `QualificationEngineId` between the background and the
 * autofill content scripts. `request` is the content script asking once at
 * init; `update` is the background pushing a change. See
 * `background/qualification-engine.background.ts` for why both exist.
 */
export const QualificationEngineCommand = Object.freeze({
  request: "getQualificationEngineId",
  update: "updateQualificationEngineId",
} as const);

export type QualificationEngineCommand =
  (typeof QualificationEngineCommand)[keyof typeof QualificationEngineCommand];

export const AutofillerCommand = Object.freeze({
  disable: "disableAutofiller",
} as const);

export type AutofillerCommand = (typeof AutofillerCommand)[keyof typeof AutofillerCommand];
