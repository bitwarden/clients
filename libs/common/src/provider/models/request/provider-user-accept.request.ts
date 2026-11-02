export class ProviderUserAcceptRequest {
  token: string;

  constructor(c: { token: string }) {
    this.token = c.token;
  }
}
