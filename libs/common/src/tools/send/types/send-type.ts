/** A type of Send. */
export const SendType = Object.freeze({
  /** Send contains plain text. */
  Text: 0,
  /** Send contains a file. */
  File: 1,
  /** Send contains an item */
  Item: 2,
} as const);

/** A type of Send. */
export type SendType = (typeof SendType)[keyof typeof SendType];
