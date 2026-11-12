/** A message key and placeholders, translated with `t()`. */
export interface Translation {
  key: string;
  placeholders?: Array<string | number>;
}

export type SimpleDialogType = "primary" | "success" | "info" | "warning" | "danger";

/** Options for `openSimpleDialog`. Strings are shown as-is; pass a `Translation` to localize. */
export type SimpleDialogOptions = {
  title: string | Translation;
  content: string | Translation;
  /** Controls the default icon and icon color. */
  type: SimpleDialogType;
  /** Custom icon class. The color still follows `type`. */
  icon?: string;
  /** Defaults to "Yes". */
  acceptButtonText?: string | Translation;
  /**
   * Defaults to "No", or "Cancel" when `acceptButtonText` is set. `null` removes the button.
   */
  cancelButtonText?: string | Translation | null;
  hideIcon?: boolean;
  /** Block Escape and backdrop clicks. */
  disableClose?: boolean;
  /** Runs on accept; the accept button shows a spinner until it settles. */
  acceptAction?: () => Promise<void>;
};
