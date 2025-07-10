export class PasswordlessAuthRequest {
  constructor(
    readonly key: string,
    readonly masterPasswordHash: string,
    readonly deviceIdentifier: string,
    readonly requestApproved: boolean,
  ) {}
}
