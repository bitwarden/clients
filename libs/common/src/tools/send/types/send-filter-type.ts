export const SendFilterType = Object.freeze({
  All: "all",
  Text: "text",
  File: "file",
  Item: "item",
} as const);

export type SendFilterType = (typeof SendFilterType)[keyof typeof SendFilterType];
