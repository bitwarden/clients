export class TwoFactorDuoUpdateRequest {
  constructor(
    public clientId: string,
    public clientSecret: string,
    public host: string,
    public userVerificationToken: string,
  ) {}
}
