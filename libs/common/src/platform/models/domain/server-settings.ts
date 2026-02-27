export class ServerSettings {
  disableUserRegistration: boolean;

  constructor(data?: ServerSettings) {
    this.disableUserRegistration = data?.disableUserRegistration ?? false;
  }
}
