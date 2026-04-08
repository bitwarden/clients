import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SessionTimeoutSettingsComponentService } from "@bitwarden/key-management-ui";

export class BrowserSessionTimeoutSettingsComponentService extends SessionTimeoutSettingsComponentService {
  constructor(
    i18nService: I18nService,
    sessionTimeoutTypeService: SessionTimeoutTypeService,
    policyService: PolicyService,
    private readonly messagingService: MessagingService,
  ) {
    super(i18nService, sessionTimeoutTypeService, policyService);
  }

  override onTimeoutSave(timeout: VaultTimeout): void {
    if (timeout === VaultTimeoutStringType.Never) {
      this.messagingService.send("bgReseedStorage");
    }
  }
}
