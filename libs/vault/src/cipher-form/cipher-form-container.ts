import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CardDetailsSectionComponent } from "./components/card-details-section/card-details-section.component";
import { ItemDetailsSectionComponent } from "./components/item-details/item-details-section.component";

/**
 * The complete form for a cipher. Includes all the sub-forms from their respective section components.
 * TODO: Add additional form sections as they are implemented.
 */
export type CipherForm = {
  itemDetails?: ItemDetailsSectionComponent["itemDetailsForm"];
  cardDetails?: CardDetailsSectionComponent["cardDetailsForm"];
};

/**
 * A container for the {@link CipherForm} that allows for registration of child form groups and patching of the cipher
 * to be updated/created. Child form components inject this container in order to register themselves with the parent form.
 *
 * This is an alternative to passing the form groups down through the component tree via @Inputs() and form updates via
 * @Outputs(). It allows child forms to define their own structure and validation rules, while still being able to
 * update the parent cipher.
 */
export abstract class CipherFormContainer {
  abstract registerChildForm<K extends keyof CipherForm>(
    name: K,
    group: Exclude<CipherForm[K], undefined>,
  ): void;

  abstract patchCipher(cipher: Partial<CipherView>): void;
}
