export class TrustedDeviceKeysRequest {
  constructor(
    public encryptedUserKey: string,
    public encryptedPublicKey: string,
    public encryptedPrivateKey: string,
  ) {}
}
