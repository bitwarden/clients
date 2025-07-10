import { CipherView } from "../models/view/cipher.view";

/**
 * Used to temporarily save the state of the AddEditComponent, e.g. when the user navigates away to the Generator page.
 * @property cipher The unsaved item being added or edited
 * @property collectionIds The collections that are selected for the item (currently these are not mapped back to
 * cipher.collectionIds until the item is saved)
 */
export type AddEditCipherInfo = {
  cipher: CipherView;
  collectionIds?: string[];
};
