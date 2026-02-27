export class SetTokensResult {
  constructor(accessToken: string, refreshToken?: string, clientIdSecretPair?: [string, string]) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.clientIdSecretPair = clientIdSecretPair;
  }
  accessToken: string;
  refreshToken?: string;
  clientIdSecretPair?: [string, string];
}
