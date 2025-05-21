// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Extended cipher view for the popup. Includes the associated collections and organization
 * if applicable.
 */
export class PopupCipherView extends CipherView {
  collections?: CollectionView[];
  organization?: Organization;

  constructor(
    cipher: CipherView,
    collections: CollectionView[] = null,
    organization: Organization = null,
  ) {
    super();
    Object.assign(this, cipher);
    this.collections = collections;
    this.organization = organization;
  }
}
