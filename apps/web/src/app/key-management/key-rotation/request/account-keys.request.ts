export class AccountKeysRequest {
  // Other keys encrypted by the userkey
  userKeyEncryptedAccountPrivateKey: string;
  accountPublicKey: string;

  constructor(userKeyEncryptedAccountPrivateKey: string, accountPublicKey: string) {
    this.userKeyEncryptedAccountPrivateKey = userKeyEncryptedAccountPrivateKey;
    this.accountPublicKey = accountPublicKey;
  }
}
