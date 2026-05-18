// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "@bitwarden/common/models/view/view";

interface SelectionResponseLike {
  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
  requireLease?: boolean;
}

export class CollectionAccessSelectionView extends View {
  readonly id: string;
  readonly readOnly: boolean;
  readonly hidePasswords: boolean;
  readonly manage: boolean;
  /**
   * Whether this principal must obtain an approved lease (Privileged Access Manager) before
   * decrypting ciphers in the collection. Defaults to `false` when omitted by the server.
   * Gated by `FeatureFlag.Pam`.
   */
  readonly requireLease?: boolean;

  constructor(response?: SelectionResponseLike) {
    super();

    if (!response) {
      return;
    }

    this.id = response.id;
    this.readOnly = response.readOnly;
    this.hidePasswords = response.hidePasswords;
    this.manage = response.manage;
    this.requireLease = response.requireLease ?? false;
  }
}
