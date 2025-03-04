import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export abstract class ChangeLoginPasswordService {
  /**
   * Attempts to find a well-known change password URL for the given cipher. Only works for Login ciphers with at
   * least one http/https URL. If no well-known change password URL is found, the first URL is returned.
   * Non-Login ciphers and Logins with no valid http/https URLs return null.
   */
  abstract getChangePasswordUrl(cipher: CipherView): Promise<string | null>;
}
