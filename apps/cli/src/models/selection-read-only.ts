import { EMPTY_GUID, Guid } from "@bitwarden/common/types/guid";

export class SelectionReadOnly {
  static template(): SelectionReadOnly {
    return new SelectionReadOnly(EMPTY_GUID, false, false);
  }

  id: Guid;
  readOnly: boolean;
  hidePasswords: boolean;

  constructor(id: Guid, readOnly: boolean, hidePasswords: boolean) {
    this.id = id;
    this.readOnly = readOnly;
    this.hidePasswords = hidePasswords || false;
  }
}
