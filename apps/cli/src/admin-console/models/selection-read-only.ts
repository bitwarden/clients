export class SelectionReadOnly {
  static template(): SelectionReadOnly {
    return new SelectionReadOnly("00000000-0000-0000-0000-000000000000", false, false, false);
  }

  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;

  constructor(id: string, readOnly: boolean, hidePasswords: boolean, manage: boolean) {
    this.id = id;
    this.readOnly = readOnly;
    this.hidePasswords = hidePasswords || false;
    this.manage = manage;
  }
}
