import { Signal } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { Observable } from "rxjs";

import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

import { SendForm } from "../send-form-container";

import { SendFormConfig } from "./send-form-config.service";

/**
 * Service to save the send using the correct endpoint(s) and encapsulating the logic for decrypting the send.
 */
export abstract class SendFormService {
  /**
   * Helper to decrypt a send and avoid the need to call the send service directly.
   * (useful for mocking tests/storybook).
   */
  abstract decryptSend(send: Send): Promise<SendView>;

  /**
   * The form group for the Send. Starts empty and is populated by child components via the `registerChildForm` method.
   */
  readonly sendForm?: Signal<FormGroup>;

  readonly submitting?: Observable<boolean>;

  /** The configuration for the Send form */
  sendFormConfig?: SendFormConfig;

  /** The original SendView of the Send the form displays */
  originalSendView?: SendView;

  /**
   * Registers a child form group with the parent form group. Used by child components to add their form groups to
   * the parent form for validation.
   * @param name - The name of the form group.
   * @param group - The form group to add.
   */
  abstract registerChildForm<K extends keyof SendForm>(
    name: K,
    group: Exclude<SendForm[K], undefined>,
  ): void;

  /**
   * Method to update the sendView with the new values. This method should be called by the child form components
   * @param updateFn - A function that takes the current sendView and returns the updated sendView
   */
  abstract patchSend(updateFn: (current: SendView) => SendView): void;

  /**
   * Initializes the Send form with a new original value and SendType
   */
  abstract initializeSendForm(sendFormConfig: SendFormConfig): Promise<void>;

  /**
   * Submits the Send form. Returns `undefined` if the form has an
   * error or the service encounters a network error on submission
   */
  abstract submitSendForm(): Promise<SendView>;

  /** Returns whether the Send form currently has edits */
  abstract sendFormHasEdits(): boolean;

  /** Sets the file to attach to the Send */
  abstract setFile(file: File): void;

  /** A function that triggers a "Discard Edits?" dialog if there are any Send
   * edits that have not yet been saved. Returns `true` if the user does
   * not want to save the edits or there are no edits to save.
   */
  abstract promptForUnsavedEdits(): Promise<boolean>;
}
