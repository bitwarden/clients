export const ReceiveListState = Object.freeze({
  Empty: "Empty",
  NoResults: "NoResults",
} as const);
export type ReceiveListState = (typeof ReceiveListState)[keyof typeof ReceiveListState];
