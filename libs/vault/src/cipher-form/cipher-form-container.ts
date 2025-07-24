// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherFormConfig } from "@bitwarden/vault";

import { AdditionalOptionsSectionComponent } from "./components/additional-options/additional-options-section.component";
import { AutofillOptionsComponent } from "./components/autofill-options/autofill-options.component";
import { CardDetailsSectionComponent } from "./components/card-details-section/card-details-section.component";
import { CustomFieldsComponent } from "./components/custom-fields/custom-fields.component";
import { IdentitySectionComponent } from "./components/identity/identity.component";
import { ItemDetailsSectionComponent } from "./components/item-details/item-details-section.component";
import { LoginDetailsSectionComponent } from "./components/login-details-section/login-details-section.component";
import { SshKeySectionComponent } from "./components/sshkey-section/sshkey-section.component";

/**
 * The complete form for a cipher. Includes all the sub-forms from their respective section components.
 */
export type CipherForm = {
  itemDetails?: ItemDetailsSectionComponent["itemDetailsForm"];
  additionalOptions?: AdditionalOptionsSectionComponent["additionalOptionsForm"];
  loginDetails?: LoginDetailsSectionComponent["loginDetailsForm"];
  autoFillOptions?: AutofillOptionsComponent["autofillOptionsForm"];
  cardDetails?: CardDetailsSectionComponent["cardDetailsForm"];
  identityDetails?: IdentitySectionComponent["identityForm"];
  sshKeyDetails?: SshKeySectionComponent["sshKeyForm"];
  customFields?: CustomFieldsComponent["customFieldsForm"];
};

/**
 * A container for the {@link CipherForm} that allows for registration of child form groups and patching of the cipher
 * to be updated/created. Child form components inject this container in order to register themselves with the parent form
 * and access configuration options.
 *
 * This is an alternative to passing the form groups down through the component tree via @Inputs() and form updates via
 * @Outputs(). It allows child forms to define their own structure and validation rules, while still being able to
 * update the parent cipher.
 */
export abstract class CipherFormContainer {
  /**
   * The configuration for the cipher form.
   */
  readonly config: CipherFormConfig;

  /**
   * The original cipher that is being edited/cloned. Used to pre-populate the form and compare changes.
   */
  readonly originalCipherView: CipherView | null;

  abstract registerChildForm<K extends keyof CipherForm>(
    name: K,
    group: Exclude<CipherForm[K], undefined>,
  ): void;

  /**
   * The website that the component publishes to edit email and username workflows.
   * Returns `null` when the cipher isn't bound to a website.
   */
  abstract get website(): string | null;

  /**
   * Method to update the cipherView with the new values. This method should be called by the child form components
   * @param updateFn - A function that takes the current cipherView and returns the updated cipherView
   */
  abstract patchCipher(updateFn: (current: CipherView) => CipherView): void;

  /**
   * Returns initial values for the CipherView, either from the config or the cached cipher
   */
  abstract getInitialCipherView(): CipherView | null;

  /** Returns true when the `CipherFormContainer` was initialized with a cached cipher available. */
  abstract initializedWithCachedCipher(): boolean;

  abstract disableFormFields(): void;

  abstract enableFormFields(): void;
}
