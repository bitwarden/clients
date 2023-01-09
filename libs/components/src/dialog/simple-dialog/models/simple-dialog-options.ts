import { SimpleDialogType } from "./simple-dialog-type.enum";
import { Translation } from "./translation";

// Using type lets devs skip optional params w/out having to pass undefined.
/**
 *
 * @typedef {Object} SimpleDialogOptions - A configuration type for the Simple Dialog component
 */
export type SimpleDialogOptions = {
  /**
   * Dialog title. If not localized, set `isLocalized` to false and pass in a `Translation`. */
  title: string | Translation;

  /** Dialog content. If not localized, set `isLocalized` to false and pass a `Translation`. */
  content: string | Translation;

  /** Dialog type. It controls default icons and icon colors. */
  type: SimpleDialogType;

  /** Dialog custom icon class. If not provided, a standard icon will be inferred from type.
   * Note: icon color is enforced based on dialog type.  */
  icon?: string;

  /**
   * Whether or not the dialog is localized (see `title`, `content`, `acceptButtonText`, and `cancelButtonText`).
   *
   * Defaults to true.
   *
   * If false, passed in strings will be treated as translation keys and translated
   * (with placeholders interpolated if they are also passed in).   */
  isLocalized?: boolean;

  /** Dialog custom accept button text. If not provided, ("yes" | i18n) will be used.
   * If not localized, set `isLocalized` to false and pass in a `Translation`  */
  acceptButtonText?: string | Translation;

  /**
   * Dialog custom cancel button text.
   * If not provided, ("no" | i18n) will be used.
   * If custom acceptButtonText is passed in, ("cancel" | i18n) will be used.
   * If null is provided, the cancel button will be removed.
   * If not localized, set `isLocalized` to false and pass in a `Translation` */
  cancelButtonText?: string | Translation;

  /** Whether or not the user can use escape or clicking the backdrop to close the dialog */
  disableClose?: boolean;
};
