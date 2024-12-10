import { PinService } from "@bitwarden/auth/common";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserId } from "@bitwarden/common/types/guid";

export class DesktopPinService extends PinService {
  override async getPinKeyEncryptedUserKeyEphemeral(userId: UserId): Promise<EncString> {
    super.validateUserId(
      userId,
      "Cannot get pin key encrypted user key ephemeral without a user ID.",
    );

    const ephemeralValue = await ipc.platform.ephemeralStore.getEphemeralValue(
      `pinKeyEncryptedUserKeyEphemeral-${userId}`,
    );
    if (ephemeralValue == null) {
      return null;
    } else {
      return new EncString(ephemeralValue);
    }
  }

  override async setPinKeyEncryptedUserKeyEphemeral(
    value: EncString,
    userId: UserId,
  ): Promise<void> {
    super.validateUserId(
      userId,
      "Cannot set pin key encrypted user key ephemeral without a user ID.",
    );

    return await ipc.platform.ephemeralStore.setEphemeralValue(
      `pinKeyEncryptedUserKeyEphemeral-${userId}`,
      value.encryptedString,
    );
  }

  override async clearPinKeyEncryptedUserKeyEphemeral(userId: UserId): Promise<void> {
    super.validateUserId(
      userId,
      "Cannot delete pin key encrypted user key ephemeral without a user ID.",
    );

    return await ipc.platform.ephemeralStore.removeEphemeralValue(
      `pinKeyEncryptedUserKeyEphemeral-${userId}`,
    );
  }
}
