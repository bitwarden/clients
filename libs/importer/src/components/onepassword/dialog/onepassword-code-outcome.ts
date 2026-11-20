/** What became of a code the user submitted in a 1Password prompt. */
export const OnePasswordCodeOutcome = Object.freeze({
  /** 1Password refused the code and asks for another one. */
  Refused: "refused",
  /** The import is over, whichever way it went, and the prompt is about to close. */
  Ended: "ended",
} as const);
export type OnePasswordCodeOutcome =
  (typeof OnePasswordCodeOutcome)[keyof typeof OnePasswordCodeOutcome];
