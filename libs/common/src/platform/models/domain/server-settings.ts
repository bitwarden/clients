export class ServerSettings {
  disableUserRegistration: boolean;
  suppressOnboardingInterstitials: boolean;

  constructor(data?: Partial<ServerSettings>) {
    this.disableUserRegistration = data?.disableUserRegistration ?? false;
    this.suppressOnboardingInterstitials = data?.suppressOnboardingInterstitials ?? false;
  }
}
