import type { InlineMenuCipherData } from "../../background/abstractions/overlay.background";

/** Which vault item the "new item" action creates, based on the focused field. */
export type InlineMenuNewItemKind = "login" | "card" | "identity" | "item";

export type InlineMenuListState =
  | { view: "locked" }
  | { view: "noResults"; newItemKind: InlineMenuNewItemKind }
  | { view: "saveLogin" }
  /** A passkey sign-in is underway. */
  | { view: "authenticating" }
  | {
      view: "ciphers";
      ciphers: InlineMenuCipherData[];
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
