// Polyfill Symbol.dispose for explicit resource management (the SDK-consumption
// pattern's `using ref = sdk.take()`) — not reliably present in the jsdom test
// environment. See e.g. `local-generator-history.service.spec.ts` for the same fix.
if (!(Symbol as any).dispose) {
  (Symbol as any).dispose = Symbol("Symbol.dispose");
}

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import type { AccessRuleAddEditRequest, AccessRuleView } from "@bitwarden/sdk-internal";

import { AccessRulesSdkService } from "./access-rules-sdk.service";

describe("AccessRulesSdkService", () => {
  let sdkService: MockSdkService;
  let accountService: AccountService;
  let logService: LogService;
  let service: AccessRulesSdkService;

  const userId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;
  const organizationId = "6c1e4c8a-9b1e-4c8a-9b1e-3b1e4c8a9b1e" as OrganizationId;
  const ruleId = "9b1e4c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e";

  const ruleView = { id: ruleId, organizationId, name: "VPN access" } as unknown as AccessRuleView;

  beforeEach(() => {
    sdkService = new MockSdkService();
    accountService = { activeAccount$: of({ id: userId }) } as unknown as AccountService;
    logService = mock<LogService>();
    service = new AccessRulesSdkService(sdkService, accountService, logService);
  });

  /** Deep-mocks the `client.commercial().pam().access_rules()` chain for the logged-in user. */
  function mockAccessRulesClient() {
    const client = sdkService.simulate.userLogin(userId);
    return client.commercial.mockDeep().pam.mockDeep().access_rules.mockDeep();
  }

  describe("listAccessRules", () => {
    it("calls access_rules().list() with the organization id and returns the result", async () => {
      const accessRules = mockAccessRulesClient();
      accessRules.list.mockResolvedValue([ruleView]);

      const result = await service.listAccessRules(organizationId);

      expect(accessRules.list).toHaveBeenCalledWith(organizationId);
      expect(result).toEqual([ruleView]);
    });

    it("logs and rethrows on failure", async () => {
      const accessRules = mockAccessRulesClient();
      const error = new Error("boom");
      accessRules.list.mockRejectedValue(error);

      await expect(service.listAccessRules(organizationId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("getAccessRule", () => {
    it("calls access_rules().get() with the organization and rule ids", async () => {
      const accessRules = mockAccessRulesClient();
      accessRules.get.mockResolvedValue(ruleView);

      const result = await service.getAccessRule(organizationId, ruleId);

      expect(accessRules.get).toHaveBeenCalledWith(organizationId, ruleId);
      expect(result).toEqual(ruleView);
    });

    it("logs and rethrows on failure", async () => {
      const accessRules = mockAccessRulesClient();
      const error = new Error("not found");
      accessRules.get.mockRejectedValue(error);

      await expect(service.getAccessRule(organizationId, ruleId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("createAccessRule", () => {
    it("calls access_rules().create() with the organization id and request", async () => {
      const accessRules = mockAccessRulesClient();
      accessRules.create.mockResolvedValue(ruleView);
      const request = { name: "VPN access" } as unknown as AccessRuleAddEditRequest;

      const result = await service.createAccessRule(organizationId, request);

      expect(accessRules.create).toHaveBeenCalledWith(organizationId, request);
      expect(result).toEqual(ruleView);
    });
  });

  describe("updateAccessRule", () => {
    it("calls access_rules().update() with the organization id, rule id, and request", async () => {
      const accessRules = mockAccessRulesClient();
      accessRules.update.mockResolvedValue(ruleView);
      const request = { name: "VPN access" } as unknown as AccessRuleAddEditRequest;

      const result = await service.updateAccessRule(organizationId, ruleId, request);

      expect(accessRules.update).toHaveBeenCalledWith(organizationId, ruleId, request);
      expect(result).toEqual(ruleView);
    });
  });

  describe("deleteAccessRule", () => {
    it("calls access_rules().delete() with the organization and rule ids", async () => {
      const accessRules = mockAccessRulesClient();
      accessRules.delete.mockResolvedValue(undefined);

      await service.deleteAccessRule(organizationId, ruleId);

      expect(accessRules.delete).toHaveBeenCalledWith(organizationId, ruleId);
    });

    it("logs and rethrows on failure", async () => {
      const accessRules = mockAccessRulesClient();
      const error = new Error("cannot delete");
      accessRules.delete.mockRejectedValue(error);

      await expect(service.deleteAccessRule(organizationId, ruleId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });
});
