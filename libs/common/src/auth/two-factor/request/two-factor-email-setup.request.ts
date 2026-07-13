export class TwoFactorEmailSetupRequest {
  constructor(
    public email: string,
    public userVerificationToken: string,
  ) {}
}
