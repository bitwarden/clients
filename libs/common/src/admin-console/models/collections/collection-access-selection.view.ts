// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "@bitwarden/common/models/view/view";

interface SelectionResponseLike {
  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
}

export class CollectionAccessSelectionView extends View {
  readonly id: string;
  readonly readOnly: boolean;
  readonly hidePasswords: boolean;
  readonly manage: boolean;

  constructor(response?: SelectionResponseLike) {
    super();

    if (!response) {
      return;
    }

    this.id = response.id;
    this.readOnly = response.readOnly;
    this.hidePasswords = response.hidePasswords;
    this.manage = response.manage;
  }
}
