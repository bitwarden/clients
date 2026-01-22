export const SendFilterType = Object.freeze({
  All: "all",
  Text: "text",
  File: "file",
} as const);

export type SendFilterType = (typeof SendFilterType)[keyof typeof SendFilterType];
