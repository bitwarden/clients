export class TwoFactorEmailUpdateRequest {
  constructor(
    public token: string,
    public email: string,
    public userVerificationToken: string,
  ) {}
}
