export class RegisterVerificationEmailClickedRequest {
  constructor(
    public email: string,
    public emailVerificationToken: string,
  ) {}
}
