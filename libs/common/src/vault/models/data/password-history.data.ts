import { PasswordHistoryResponse } from "../response/password-history.response";

export class PasswordHistoryData {
  password!: string;
  lastUsedDate!: string;

  constructor(response?: PasswordHistoryResponse) {
    if (response == null) {
      return;
    }

    this.password = response.password;
    this.lastUsedDate = response.lastUsedDate;
  }
}
