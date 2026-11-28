export type ClipboardWriteMessage = {
  text: string;
  password?: boolean;
  /** Overrides the user's clear-clipboard-delay setting for this write, if given. */
  clearMs?: number | null;
};
