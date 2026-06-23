export class TwoFactorDuoUpdateRequest {
  clientId!: string;
  clientSecret!: string;
  host!: string;
  userVerificationToken!: string;
}
