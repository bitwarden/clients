import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { VaultItemsTransferService } from "@bitwarden/vault";

import {
  MultiStepPolicyEditDialogComponent,
  PolicyEditDialogResult,
} from "../../admin-console/organizations/policies";
import { UnifiedUpgradePromptService } from "../../billing/individual/upgrade/services";

import { WebVaultExtensionPromptService } from "./web-vault-extension-prompt.service";
import { WebVaultPromptService } from "./web-vault-prompt.service";
import { WelcomeDialogService } from "./welcome-dialog.service";

describe("WebVaultPromptService", () => {
  let service: WebVaultPromptService;

  const mockUserId = "user-123" as UserId;
  const mockOrganizationId = "org-456";

  const open = jest.fn();
  const policies$ = jest.fn().mockReturnValue(of([]));
  const configurationAutoConfirm$ = jest
    .fn()
    .mockReturnValue(
      of({ showSetupDialog: false, enabled: false, showBrowserNotification: false }),
    );
  const upsertAutoConfirm = jest.fn().mockResolvedValue(undefined);
  const organizations$ = jest.fn().mockReturnValue(of([]));
  const displayUpgradePromptConditionally = jest.fn().mockResolvedValue(false);
  const enforceOrganizationDataOwnership = jest.fn().mockResolvedValue(undefined);
  const conditionallyShowWelcomeDialog = jest.fn().mockResolvedValue(false);
  const logError = jest.fn();
  const conditionallyPromptUserForExtension = jest.fn().mockResolvedValue(false);

  let activeAccount$: BehaviorSubject<Account | null>;

  function createAccount(overrides: Partial<Account> = {}): Account {
    return {
      id: mockUserId,
      creationDate: new Date(),
      ...overrides,
    } as Account;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    activeAccount$ = new BehaviorSubject<Account | null>(createAccount());

    TestBed.configureTestingModule({
      providers: [
        WebVaultPromptService,
        { provide: UnifiedUpgradePromptService, useValue: { displayUpgradePromptConditionally } },
        { provide: VaultItemsTransferService, useValue: { enforceOrganizationDataOwnership } },
        { provide: PolicyService, useValue: { policies$ } },
        { provide: AccountService, useValue: { activeAccount$ } },
        {
          provide: AutomaticUserConfirmationService,
          useValue: { configuration$: configurationAutoConfirm$, upsert: upsertAutoConfirm },
        },
        { provide: OrganizationService, useValue: { organizations$ } },
        { provide: DialogService, useValue: { open } },
        { provide: LogService, useValue: { error: logError } },
        {
          provide: WebVaultExtensionPromptService,
          useValue: { conditionallyPromptUserForExtension },
        },
        {
          provide: WelcomeDialogService,
          useValue: { conditionallyShowWelcomeDialog, conditionallyPromptUserForExtension },
        },
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

    it("calls conditionallyPromptUserForExtension with the userId", async () => {
      await service.conditionallyPromptUser();

      expect(
        service["webVaultExtensionPromptService"].conditionallyPromptUserForExtension,
      ).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("setupAutoConfirm", () => {
    it("shows dialog when all conditions are met", fakeAsync(() => {
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
        .spyOn(MultiStepPolicyEditDialogComponent, "open")
        .mockReturnValue(dialogRefMock);

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).toHaveBeenCalledWith(expect.anything(), {
        data: {
          policy: expect.any(Object),
          organization: expect.objectContaining({ id: mockOrganizationId }),
        },
      });

      const passedPolicy = openSpy.mock.calls[0][1].data.policy;
      expect(passedPolicy.firstTimeDialog).toBe(true);

      dialogClosedSubject.next(null);
    }));

    it("does not show dialog when policy is already enabled", fakeAsync(() => {
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

      const openSpy = jest.spyOn(MultiStepPolicyEditDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when showSetupDialog is false", fakeAsync(() => {
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: false, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(MultiStepPolicyEditDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when organization is undefined", fakeAsync(() => {
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));
      organizations$.mockReturnValueOnce(of([]));

      const openSpy = jest.spyOn(MultiStepPolicyEditDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when organization cannot enable auto-confirm policy", fakeAsync(() => {
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
        canManagePolicies: false,
      } as Organization;

      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(MultiStepPolicyEditDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));
  });
});
