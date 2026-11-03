import { UserId } from "@bitwarden/common/types/guid";
import { DefaultWebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";

/** Electron's `navigator.credentials` can't use passkeys, so passkey unlock isn't offered. */
export class DesktopWebAuthnPrfUnlockService extends DefaultWebAuthnPrfUnlockService {
  override isPrfUnlockAvailable(_userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }
}
