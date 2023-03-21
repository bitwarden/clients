import { Guid } from "../../types/guid";

export class SelectionReadOnlyRequest {
  id: Guid;
  readOnly: boolean;
  hidePasswords: boolean;

  constructor(id: Guid, readOnly: boolean, hidePasswords: boolean) {
    this.id = id;
    this.readOnly = readOnly;
    this.hidePasswords = hidePasswords;
  }
}
