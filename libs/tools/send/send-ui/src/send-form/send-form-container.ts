// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

import { SendFormConfig } from "./abstractions/send-form-config.service";
import { SendOptionsComponent } from "./components/options/send-options.component";
import { SendDetailsComponent } from "./components/send-details/send-details.component";
import { SendFileDetailsComponent } from "./components/send-details/send-file-details.component";
import { SendTextDetailsComponent } from "./components/send-details/send-text-details.component";
/**
 * The complete form for a send. Includes all the sub-forms from their respective section components.
 * TODO: Add additional form sections as they are implemented.
 */
export type SendForm = {
  sendDetailsForm?: SendDetailsComponent["sendDetailsForm"];
  sendTextDetailsForm?: SendTextDetailsComponent["sendTextDetailsForm"];
  sendFileDetailsForm?: SendFileDetailsComponent["sendFileDetailsForm"];
  sendOptionsForm?: SendOptionsComponent["sendOptionsForm"];
};

/**
 * A container for the {@link SendForm} that allows for registration of child form groups and patching of the send
 * to be updated/created. Child form components inject this container in order to register themselves with the parent form
 * and access configuration options.
 *
 * This is an alternative to passing the form groups down through the component tree via @Inputs() and form updates via
 * @Outputs(). It allows child forms to define their own structure and validation rules, while still being able to
 * update the parent send.
 */
export abstract class SendFormContainer {
  /**
   * The configuration for the send form.
   */
  readonly config: SendFormConfig;

  /**
   * The original send that is being edited/cloned. Used to pre-populate the form and compare changes.
   */
  readonly originalSendView: SendView | null;

  abstract registerChildForm<K extends keyof SendForm>(
    name: K,
    group: Exclude<SendForm[K], undefined>,
  ): void;

  abstract onFileSelected(file: File): void;

  abstract patchSend(updateFn: (current: SendView) => SendView): void;
}
