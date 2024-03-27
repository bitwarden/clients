import { ButtonType } from "@bitwarden/components";

/**
 * @typedef {Object} UserVerificationCalloutOptions - Configuration options for the callout displayed in the dialog body.
 */
export type UserVerificationCalloutOptions = {
  /**
   * The translation key for the text of the callout.
   */
  text: string;

  /**
   * The type of the callout.
   * Can be "warning", "danger", "info", or "success".
   */
  type: "warning" | "danger" | "info" | "success";
};

/**
 * @typedef {Object} UserVerificationConfirmButtonOptions - Configuration options for the confirm button in the User Verification Dialog.
 */
export type UserVerificationConfirmButtonOptions = {
  /**
   * The translation key for the text of the confirm button.
   */
  text: string;

  /**
   * The type of the confirm button.
   * It should be a valid ButtonType.
   */
  type: ButtonType;
};

/**
 * @typedef {Object} UserVerificationDialogOptions - Configuration parameters for the user verification dialog.
 */
export type UserVerificationDialogOptions = {
  /**
   * The translation key for the title of the dialog.
   * This is optional and defaults to "Verification required" if not provided.
   */
  title?: string;

  /**
   * The translation key for the body text of the dialog.
   * Optional.
   */
  bodyText?: string;

  /**
   * Options for a callout to be displayed in the dialog body below the body text.
   * Optional.
   */
  calloutOptions?: UserVerificationCalloutOptions;

  /**
   * Options for the confirm button.
   * Optional. The default text is "Submit" and the default type is "primary".
   */
  confirmButtonOptions?: UserVerificationConfirmButtonOptions;

  /**
   * Indicates whether the verification is only performed client-side. Includes local MP verification, PIN, and Biometrics.
   * Optional.
   * **Important:** Only for use on desktop and browser platforms as when there are no client verification methods, the user is instructed to set a pin (which is not supported on web)
   */
  clientSideOnlyVerification?: boolean;
};

/**
 * @typedef {Object} UserVerificationDialogResult - The result of the user verification dialog.
 */
export type UserVerificationDialogResult = {
  /**
   * The user's action.
   */
  userAction: "confirm" | "cancel";

  /**
   * Indicates whether the verification was successful.
   */
  verificationSuccess: boolean;

  /**
   * Indicates whether there are no available client verification methods.
   * Optional and only relevant when the dialog is configured to only perform client-side verification.
   */
  noAvailableClientVerificationMethods?: boolean;
};
