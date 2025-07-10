export class SelectionReadOnlyRequest {
  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;

  constructor(id: string, readOnly: boolean, hidePasswords: boolean, manage: boolean) {
    this.id = id;
    this.readOnly = readOnly;
    this.hidePasswords = hidePasswords;
    this.manage = manage;
  }
}
