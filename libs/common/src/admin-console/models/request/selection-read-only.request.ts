export class SelectionReadOnlyRequest {
  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
  /**
   * Whether this principal must obtain an approved lease (Privileged Access Manager) before
   * decrypting ciphers in the collection. Orthogonal to read/edit/manage permissions; gated by
   * `FeatureFlag.Pam` (`pm-37044-pam-v-0`).
   */
  requireLease: boolean;

  constructor(
    id: string,
    readOnly: boolean,
    hidePasswords: boolean,
    manage: boolean,
    requireLease: boolean = false,
  ) {
    this.id = id;
    this.readOnly = readOnly;
    this.hidePasswords = hidePasswords;
    this.manage = manage;
    this.requireLease = requireLease;
  }
}
