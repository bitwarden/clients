export class UserPreferencesRequest {
  data: string;

  constructor(encryptedData: string) {
    this.data = encryptedData;
  }
}
