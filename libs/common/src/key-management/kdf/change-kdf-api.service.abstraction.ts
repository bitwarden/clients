import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";

export abstract class ChangeKdfApiService {
  /**
   * Sends a request to update the user's KDF parameters.
   * @param request The KDF request containing authentication data, unlock data, and old authentication data
   */
  abstract updateUserKdfParams(request: KdfRequest): Promise<void>;
}
