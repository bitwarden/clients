export interface Settings {
  disableUserRegistration: boolean;
}

export class ServerSettings implements Settings {
  disableUserRegistration: boolean;

  constructor(data?: Settings) {
    this.disableUserRegistration = data?.disableUserRegistration ?? false;
  }
}
