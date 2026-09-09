export class ServerSettings {
  disableUserRegistration: boolean;
  suppressOnboardingInterstitials: boolean;
  enableEmailVerification: boolean;

  constructor(data?: Partial<ServerSettings>) {
    this.disableUserRegistration = data?.disableUserRegistration ?? false;
    this.suppressOnboardingInterstitials = data?.suppressOnboardingInterstitials ?? false;
    this.enableEmailVerification = data?.enableEmailVerification ?? false;
  }
}
