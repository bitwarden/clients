export class TwoFactorYubiKeyUpdateRequest {
  constructor(
    public key1: string,
    public key2: string,
    public key3: string,
    public key4: string,
    public key5: string,
    public nfc: boolean,
    public userVerificationToken: string,
  ) {}
}
