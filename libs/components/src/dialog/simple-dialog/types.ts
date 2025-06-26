export interface Translation {
  key: string;
  placeholders?: Array<string | number>;
}

// Using type lets devs skip optional params w/out having to pass undefined.
/**
 *
 * @typedef {Object} SimpleDialogOptions - A configuration type for the Simple Dialog component
 */
export type SimpleDialogOptions = {
  /**
   * Dialog title.
   *
   * If not localized, pass in a `Translation`. */
  title: string | Translation;

  /** Dialog content.
   *
   * If not localized, pass in a `Translation`. */
  content: string | Translation;

  /** Dialog type. It controls default icons and icon colors. */
  type: SimpleDialogType;

  /** Dialog custom icon class.
   *
   * If not provided, a standard icon will be inferred from type.
   * Note: icon color is enforced based on dialog type.  */
  icon?: string;

  /** Dialog custom accept button text.
   *
   * If not provided, ("yes" | i18n) will be used.
   *
   * If not localized, pass in a `Translation`  */
  acceptButtonText?: string | Translation;

  /**
   * Dialog custom cancel button text.
   *
   * If not provided, ("no" | i18n) will be used.
   *
   * If custom acceptButtonText is passed in, ("cancel" | i18n) will be used.
   *
   * If null is provided, the cancel button will be removed.
   *
   * If not localized, pass in a `Translation` */
  cancelButtonText?: string | Translation | null;

  /** Whether or not the user can use escape or clicking the backdrop to close the dialog */
  disableClose?: boolean;

  /**
   * Custom accept action. Runs when the user clicks the accept button and shows a loading spinner until the promise
   * is resolved.
   */
  acceptAction?: () => Promise<void>;
};

export type SimpleDialogType = "primary" | "success" | "info" | "warning" | "danger";
