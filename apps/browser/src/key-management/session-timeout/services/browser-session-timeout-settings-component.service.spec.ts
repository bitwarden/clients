import { mock } from "jest-mock-extended";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { BrowserSessionTimeoutSettingsComponentService } from "./browser-session-timeout-settings-component.service";

describe("BrowserSessionTimeoutSettingsComponentService", () => {
  let service: BrowserSessionTimeoutSettingsComponentService;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockSessionTimeoutTypeService: jest.Mocked<SessionTimeoutTypeService>;
  let mockPolicyService: jest.Mocked<PolicyService>;
  let mockMessagingService: jest.Mocked<MessagingService>;

  beforeEach(() => {
    mockI18nService = mock<I18nService>();
    mockSessionTimeoutTypeService = mock<SessionTimeoutTypeService>();
    mockPolicyService = mock<PolicyService>();
    mockMessagingService = mock<MessagingService>();

    service = new BrowserSessionTimeoutSettingsComponentService(
      mockI18nService,
      mockSessionTimeoutTypeService,
      mockPolicyService,
      mockMessagingService,
    );
  });

  describe("onTimeoutSave", () => {
    it("should call messagingService.send with 'bgReseedStorage' when timeout is Never", () => {
      service.onTimeoutSave(VaultTimeoutStringType.Never);

      expect(mockMessagingService.send).toHaveBeenCalledWith("bgReseedStorage");
    });

    it.each([
      VaultTimeoutNumberType.Immediately,
      VaultTimeoutNumberType.OnMinute,
      VaultTimeoutNumberType.EightHours,
      VaultTimeoutStringType.OnIdle,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutStringType.OnLocked,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.Custom,
    ])("should not call messagingService.send when timeout is %s", (timeoutValue) => {
      service.onTimeoutSave(timeoutValue);

      expect(mockMessagingService.send).not.toHaveBeenCalled();
    });
  });
});
