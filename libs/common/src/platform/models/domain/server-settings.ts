export class ServerSettings {
  disableUserRegistration: boolean;
  suppressOnboardingInterstitials: boolean;
  disableEmailVerification: boolean;

  constructor(data?: Partial<ServerSettings>) {
    this.disableUserRegistration = data?.disableUserRegistration ?? false;
    this.suppressOnboardingInterstitials = data?.suppressOnboardingInterstitials ?? false;
    this.disableEmailVerification = data?.disableEmailVerification ?? false;
  }
}
