import { fakeAsync, flush } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import {
  MaximumSessionTimeoutPolicyData,
  SessionTimeoutTypeService,
} from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";

import { SessionTimeoutSettingsComponentService } from "./session-timeout-settings-component.service";

describe("SessionTimeoutSettingsComponentService", () => {
  let service: SessionTimeoutSettingsComponentService;
  let mockI18nService: MockProxy<I18nService>;
  let mockSessionTimeoutTypeService: MockProxy<SessionTimeoutTypeService>;
  let mockPolicyService: MockProxy<PolicyService>;

  const mockUserId = "test-user-id" as UserId;

  beforeEach(() => {
    mockI18nService = mock<I18nService>();
    mockSessionTimeoutTypeService = mock<SessionTimeoutTypeService>();
    mockPolicyService = mock<PolicyService>();

    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);
    mockSessionTimeoutTypeService.isAvailable.mockResolvedValue(true);
    mockPolicyService.policiesByType$.mockReturnValue(of([]));

    service = new SessionTimeoutSettingsComponentService(
      mockI18nService,
      mockSessionTimeoutTypeService,
      mockPolicyService,
    );
  });

  it("should create", () => {
    expect(service).toBeTruthy();
  });

  describe("availableTimeoutOptions$", () => {
    it("should return all options when isAvailable returns true for all", fakeAsync(async () => {
      mockSessionTimeoutTypeService.isAvailable.mockResolvedValue(true);
      flush();

      const options = await firstValueFrom(service["availableTimeoutOptions$"]);

      assertAllTimeoutTypes(options);
    }));

    it("should filter options based on isAvailable() results", fakeAsync(async () => {
      mockSessionTimeoutTypeService.isAvailable.mockImplementation(async (value: VaultTimeout) => {
        return (
          value === VaultTimeoutNumberType.OnMinute ||
          value === 5 ||
          value === VaultTimeoutStringType.OnLocked
        );
      });
      flush();

      const options = await firstValueFrom(service["availableTimeoutOptions$"]);

      expect(options).toHaveLength(3);
      expect(options).toContainEqual({ name: "oneMinute", value: VaultTimeoutNumberType.OnMinute });
      expect(options).toContainEqual({ name: "fiveMinutes", value: 5 });
      expect(options).toContainEqual({ name: "onLocked", value: VaultTimeoutStringType.OnLocked });
      expect(options).not.toContainEqual({
        name: "immediately",
        value: VaultTimeoutNumberType.Immediately,
      });
    }));
  });

  describe("policyFilteredTimeoutOptions$", () => {
    it("should return all available options when no policy for user", fakeAsync(async () => {
      mockPolicyService.policiesByType$.mockReturnValue(of([]));
      flush();

      const options = await firstValueFrom(service.policyFilteredTimeoutOptions$(mockUserId));

      assertAllTimeoutTypes(options);
    }));

    describe('policy type "immediately"', () => {
      it.each([VaultTimeoutNumberType.Immediately, VaultTimeoutNumberType.OnMinute])(
        "should only return immediately option or fallback",
        fakeAsync(async (availableTimeoutOrPromoted: VaultTimeout) => {
          const policyData: MaximumSessionTimeoutPolicyData = {
            type: "immediately",
            minutes: 0,
          };
          const policy = {
            id: "policy-id",
            organizationId: "org-id",
            type: PolicyType.MaximumVaultTimeout,
            data: policyData,
            enabled: true,
          } as Policy;

          mockPolicyService.policiesByType$.mockReturnValue(of([policy]));
          mockSessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(
            availableTimeoutOrPromoted,
          );
          flush();

          const options = await firstValueFrom(service.policyFilteredTimeoutOptions$(mockUserId));

          expect(options).toHaveLength(1);
          if (availableTimeoutOrPromoted === VaultTimeoutNumberType.Immediately) {
            expect(options[0]).toEqual({
              name: "immediately",
              value: VaultTimeoutNumberType.Immediately,
            });
          } else {
            expect(options[0]).toEqual({
              name: "oneMinute",
              value: VaultTimeoutNumberType.OnMinute,
            });
          }
        }),
      );
    });

    describe('policy type "onSystemLock"', () => {
      it.each([VaultTimeoutStringType.OnLocked, VaultTimeoutStringType.OnRestart])(
        "should allow immediately, numeric, custom, onLocked, onIdle, onSleep or fallback",
        fakeAsync(async (availableTimeoutOrPromoted: VaultTimeout) => {
          const policyData: MaximumSessionTimeoutPolicyData = {
            type: "onSystemLock",
            minutes: 0,
          };
          const policy = {
            id: "policy-id",
            organizationId: "org-id",
            type: PolicyType.MaximumVaultTimeout,
            data: policyData,
            enabled: true,
          } as Policy;

          mockPolicyService.policiesByType$.mockReturnValue(of([policy]));
          mockSessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(
            availableTimeoutOrPromoted,
          );
          flush();

          const options = await firstValueFrom(service.policyFilteredTimeoutOptions$(mockUserId));

          assertNumericTimeoutTypes(options);
          expect(options).toContainEqual({
            name: "onLocked",
            value: VaultTimeoutStringType.OnLocked,
          });
          expect(options).toContainEqual({ name: "onIdle", value: VaultTimeoutStringType.OnIdle });
          expect(options).toContainEqual({
            name: "onSleep",
            value: VaultTimeoutStringType.OnSleep,
          });
          expect(options).toContainEqual({ name: "custom", value: VaultTimeoutStringType.Custom });
          expect(options).not.toContainEqual({
            name: "never",
            value: VaultTimeoutStringType.Never,
          });
          if (availableTimeoutOrPromoted === VaultTimeoutStringType.OnLocked) {
            expect(options).not.toContainEqual({
              name: "sessionTimeoutOnAppRestart",
              value: VaultTimeoutStringType.OnRestart,
            });
          } else {
            expect(options).toContainEqual({
              name: "sessionTimeoutOnAppRestart",
              value: VaultTimeoutStringType.OnRestart,
            });
          }
        }),
      );
    });

    describe('policy type "onAppRestart"', () => {
      it("should allow immediately, numeric, custom, and onRestart", fakeAsync(async () => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "onAppRestart",
          minutes: 0,
        };
        const policy = {
          id: "policy-id",
          organizationId: "org-id",
          type: PolicyType.MaximumVaultTimeout,
          data: policyData,
          enabled: true,
        } as Policy;

        mockPolicyService.policiesByType$.mockReturnValue(of([policy]));
        flush();

        const options = await firstValueFrom(service.policyFilteredTimeoutOptions$(mockUserId));

        assertNumericTimeoutTypes(options);
        expect(options).toContainEqual({
          name: "sessionTimeoutOnAppRestart",
          value: VaultTimeoutStringType.OnRestart,
        });
        expect(options).toContainEqual({ name: "custom", value: VaultTimeoutStringType.Custom });
        expect(options).not.toContainEqual({
          name: "onLocked",
          value: VaultTimeoutStringType.OnLocked,
        });
        expect(options).not.toContainEqual({
          name: "onIdle",
          value: VaultTimeoutStringType.OnIdle,
        });
        expect(options).not.toContainEqual({
          name: "onSleep",
          value: VaultTimeoutStringType.OnSleep,
        });
        expect(options).not.toContainEqual({ name: "never", value: VaultTimeoutStringType.Never });
      }));
    });

    describe('policy type "custom", null, or undefined', () => {
      it.each(["custom", null, undefined])(
        "should allow immediately, custom, and numeric values within policy limit when type is %s",
        fakeAsync(async (policyType: "custom" | null | undefined) => {
          const policyData: MaximumSessionTimeoutPolicyData = {
            type: policyType as "custom" | null | undefined,
            minutes: 15,
          };
          const policy = {
            id: "policy-id",
            organizationId: "org-id",
            type: PolicyType.MaximumVaultTimeout,
            data: policyData,
            enabled: true,
          } as Policy;

          mockPolicyService.policiesByType$.mockReturnValue(of([policy]));
          flush();

          const options = await firstValueFrom(service.policyFilteredTimeoutOptions$(mockUserId));

          expect(options).toContainEqual({
            name: "immediately",
            value: VaultTimeoutNumberType.Immediately,
          });
          expect(options).toContainEqual({
            name: "oneMinute",
            value: VaultTimeoutNumberType.OnMinute,
          });
          expect(options).toContainEqual({ name: "fiveMinutes", value: 5 });
          expect(options).toContainEqual({ name: "fifteenMinutes", value: 15 });
          expect(options).toContainEqual({ name: "custom", value: VaultTimeoutStringType.Custom });
          expect(options).not.toContainEqual({ name: "thirtyMinutes", value: 30 });
          expect(options).not.toContainEqual({ name: "oneHour", value: 60 });
          expect(options).not.toContainEqual({ name: "fourHours", value: 240 });
          expect(options).not.toContainEqual({
            name: "onLocked",
            value: VaultTimeoutStringType.OnLocked,
          });
          expect(options).not.toContainEqual({
            name: "onIdle",
            value: VaultTimeoutStringType.OnIdle,
          });
          expect(options).not.toContainEqual({
            name: "onSleep",
            value: VaultTimeoutStringType.OnSleep,
          });
          expect(options).not.toContainEqual({
            name: "sessionTimeoutOnAppRestart",
            value: VaultTimeoutStringType.OnRestart,
          });
          expect(options).not.toContainEqual({
            name: "never",
            value: VaultTimeoutStringType.Never,
          });
        }),
      );
    });

    describe('policy type "never"', () => {
      it("should return all available options", fakeAsync(async () => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "never",
          minutes: 0,
        };
        const policy = {
          id: "policy-id",
          organizationId: "org-id",
          type: PolicyType.MaximumVaultTimeout,
          data: policyData,
          enabled: true,
        } as Policy;

        mockPolicyService.policiesByType$.mockReturnValue(of([policy]));
        flush();

        const options = await firstValueFrom(service.policyFilteredTimeoutOptions$(mockUserId));

        assertAllTimeoutTypes(options);
      }));
    });
  });

  function assertAllTimeoutTypes(options: VaultTimeoutOption[]) {
    assertNumericTimeoutTypes(options);
    expect(options).toContainEqual({ name: "onIdle", value: VaultTimeoutStringType.OnIdle });
    expect(options).toContainEqual({ name: "onSleep", value: VaultTimeoutStringType.OnSleep });
    expect(options).toContainEqual({ name: "onLocked", value: VaultTimeoutStringType.OnLocked });
    expect(options).toContainEqual({
      name: "sessionTimeoutOnAppRestart",
      value: VaultTimeoutStringType.OnRestart,
    });
    expect(options).toContainEqual({ name: "never", value: VaultTimeoutStringType.Never });
    expect(options).toContainEqual({ name: "custom", value: VaultTimeoutStringType.Custom });
  }

  function assertNumericTimeoutTypes(options: VaultTimeoutOption[]) {
    expect(options).toContainEqual({
      name: "immediately",
      value: VaultTimeoutNumberType.Immediately,
    });
    expect(options).toContainEqual({ name: "oneMinute", value: VaultTimeoutNumberType.OnMinute });
    expect(options).toContainEqual({ name: "fiveMinutes", value: 5 });
    expect(options).toContainEqual({ name: "fifteenMinutes", value: 15 });
    expect(options).toContainEqual({ name: "thirtyMinutes", value: 30 });
    expect(options).toContainEqual({ name: "oneHour", value: 60 });
    expect(options).toContainEqual({ name: "fourHours", value: 240 });
  }
});
