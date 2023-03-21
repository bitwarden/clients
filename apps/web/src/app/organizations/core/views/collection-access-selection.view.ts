import { View } from "@bitwarden/common/models/view/view";
import { Guid } from "@bitwarden/common/types/guid";

interface SelectionResponseLike {
  id: Guid;
  readOnly: boolean;
  hidePasswords: boolean;
}

export class CollectionAccessSelectionView extends View {
  readonly id: Guid;
  readonly readOnly: boolean;
  readonly hidePasswords: boolean;

  constructor(response?: SelectionResponseLike) {
    super();

    if (!response) {
      return;
    }

    this.id = response.id;
    this.readOnly = response.readOnly;
    this.hidePasswords = response.hidePasswords;
  }
}
