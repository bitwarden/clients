export class LoginStartRequest {
  constructor(
    readonly email: string,
    readonly credentialRequest: string,
  ) {}
}
