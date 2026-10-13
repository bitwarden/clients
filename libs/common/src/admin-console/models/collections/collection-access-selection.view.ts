import { View } from "../../../models/view/view";

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

  constructor(response: SelectionResponseLike) {
    super();
    this.id = response.id;
    this.readOnly = response.readOnly;
    this.hidePasswords = response.hidePasswords;
    this.manage = response.manage;
  }
}
