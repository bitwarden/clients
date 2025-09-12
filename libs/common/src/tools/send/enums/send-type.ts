export const SendType = Object.freeze({
  Text: 0,
  File: 1,
} as const);

export type SendType = (typeof SendType)[keyof typeof SendType];
