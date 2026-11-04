import { DefaultLoginViaWebAuthnComponentService } from "@bitwarden/angular/auth/login-via-webauthn/default-login-via-webauthn-component.service";
import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

/**
 * On Linux, the passkey assertion comes back from the user's browser through the system's URL
 * scheme handler, where another app could see the request and return a valid assertion for its
 * own account. So the user confirms the account before logging in to it.
 */
export class DesktopLoginViaWebAuthnComponentService extends DefaultLoginViaWebAuthnComponentService {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService,
  ) {
    super();
  }

  async confirmAccount(email: string): Promise<boolean> {
    if (this.platformUtilsService.getDevice() !== DeviceType.LinuxDesktop) {
      return true;
    }
    return this.dialogService.openSimpleDialog({
      title: { key: "confirmPasskeyAccountTitle" },
      content: { key: "confirmPasskeyAccountDesc", placeholders: [email] },
      type: "warning",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });
  }
}
