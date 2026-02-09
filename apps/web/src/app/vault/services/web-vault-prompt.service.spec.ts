import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { VaultItemsTransferService } from "@bitwarden/vault";

import {
  AutoConfirmPolicyDialogComponent,
  PolicyEditDialogResult,
} from "../../admin-console/organizations/policies";
import { UnifiedUpgradePromptService } from "../../billing/individual/upgrade/services";

import { WebVaultPromptService } from "./web-vault-prompt.service";

describe("WebVaultPromptService", () => {
  let service: WebVaultPromptService;

  const mockUserId = "user-123" as UserId;
  const mockOrganizationId = "org-456";

  const getFeatureFlag$ = jest.fn().mockReturnValue(of(false));
  const open = jest.fn();
  const policies$ = jest.fn().mockReturnValue(of([]));
  const configurationAutoConfirm$ = jest
    .fn()
    .mockReturnValue(
      of({ showSetupDialog: false, enabled: false, showBrowserNotification: false }),
    );
  const upsertAutoConfirm = jest.fn().mockResolvedValue(undefined);
  const organizations$ = jest.fn().mockReturnValue(of([]));
  const displayUpgradePromptConditionally = jest.fn().mockResolvedValue(undefined);
  const enforceOrganizationDataOwnership = jest.fn().mockResolvedValue(undefined);
  const logError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        WebVaultPromptService,
        { provide: UnifiedUpgradePromptService, useValue: { displayUpgradePromptConditionally } },
        { provide: VaultItemsTransferService, useValue: { enforceOrganizationDataOwnership } },
        { provide: PolicyService, useValue: { policies$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: mockUserId }) } },
        {
          provide: AutomaticUserConfirmationService,
          useValue: { configuration$: configurationAutoConfirm$, upsert: upsertAutoConfirm },
        },
        { provide: OrganizationService, useValue: { organizations$ } },
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        { provide: DialogService, useValue: { open } },
        { provide: LogService, useValue: { error: logError } },
      ],
    });

    service = TestBed.inject(WebVaultPromptService);
  });

  describe("conditionallyPromptUser", () => {
    it("calls displayUpgradePromptConditionally", async () => {
      await service.conditionallyPromptUser();

      expect(
        service["unifiedUpgradePromptService"].displayUpgradePromptConditionally,
      ).toHaveBeenCalled();
    });

    it("calls enforceOrganizationDataOwnership with the userId", async () => {
      await service.conditionallyPromptUser();

      expect(
        service["vaultItemTransferService"].enforceOrganizationDataOwnership,
      ).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("setupAutoConfirm", () => {
    it("shows dialog when all conditions are met", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
        canManagePolicies: true,
        canEnableAutoConfirmPolicy: true,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const dialogClosedSubject = new BehaviorSubject<PolicyEditDialogResult>(null);
      const dialogRefMock = {
        closed: dialogClosedSubject.asObservable(),
      } as unknown as DialogRef<PolicyEditDialogResult>;

      const openSpy = jest
        .spyOn(AutoConfirmPolicyDialogComponent, "open")
        .mockReturnValue(dialogRefMock);

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).toHaveBeenCalledWith(expect.anything(), {
        data: {
          policy: expect.any(Object),
          organizationId: mockOrganizationId,
          firstTimeDialog: true,
        },
      });

      dialogClosedSubject.next(null);
    }));

    it("does not show dialog when feature flag is disabled", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(false));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when policy is already enabled", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );

      const mockPolicy = {
        type: PolicyType.AutoConfirm,
        enabled: true,
      } as Policy;
      policies$.mockReturnValueOnce(of([mockPolicy]));

      const mockOrg = {
        id: mockOrganizationId,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when showSetupDialog is false", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: false, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when organization is undefined", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));
      organizations$.mockReturnValueOnce(of([]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when organization cannot enable auto-confirm policy", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
        canManagePolicies: false,
      } as Organization;

      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));
  });
});
