import type { InlineMenuCipherData } from "../../background/abstractions/overlay.background";

/** Which vault item the "new item" action creates, based on the focused field. */
export type InlineMenuNewItemKind = "login" | "card" | "identity" | "item";

export type InlineMenuListState =
  | { view: "locked" }
  | { view: "noResults"; newItemKind: InlineMenuNewItemKind }
  | { view: "saveLogin" }
  | {
      view: "ciphers";
      ciphers: InlineMenuCipherData[];
      /** Group passkeys and passwords under headings. Defaults to grouping when both are present. */
      showPasskeyHeadings?: boolean;
      /** Omit to hide the new item action. */
      newItemKind?: InlineMenuNewItemKind;
      /** Freezes TOTP countdowns, for stories and screenshots. */
      totpSecondsRemaining?: number;
    }
  | {
      view: "passwordGenerator";
      password: string;
      /** Defaults to "Fill generated password". */
      heading?: string;
    };
