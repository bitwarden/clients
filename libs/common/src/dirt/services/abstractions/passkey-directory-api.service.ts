import { PasskeyDirectoryEntryResponse } from "@bitwarden/common/dirt";

import { UserId } from "../../../types/guid";

/**
 * Service for retrieving the passkey directory from the server.
 */
export abstract class PasskeyDirectoryApiService {
  /**
   * Retrieves the list of services that support passkey authentication.
   * @param userId - The user ID for authentication.
   * @returns A list of passkey directory entries containing domain names and setup instructions.
   */
  abstract getPasskeyDirectory(userId: UserId): Promise<PasskeyDirectoryEntryResponse[]>;
}
