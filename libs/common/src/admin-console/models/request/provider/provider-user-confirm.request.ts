import { UnsignedSharedKey } from "@bitwarden/sdk-internal";

export class ProviderUserConfirmRequest {
  protected key: string;

  constructor(key: UnsignedSharedKey) {
    this.key = key;
  }
}
