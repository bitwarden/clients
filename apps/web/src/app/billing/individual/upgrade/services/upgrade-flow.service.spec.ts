import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  UnifiedUpgradeDialogResult,
  UnifiedUpgradeDialogStatus,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

import { UpgradeFlowService } from "./upgrade-flow.service";

describe("UpgradeFlowService", () => {
  let service: UpgradeFlowService;
  let mockDialogService: MockProxy<DialogService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockSyncService: MockProxy<SyncService>;
  let mockRouter: MockProxy<Router>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let activeAccount$: BehaviorSubject<Account | null>;

  const mockAccount: Account = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
    }),
  };

  const dialogRefClosingWith = (result: UnifiedUpgradeDialogResult) =>
    ({ closed: of(result) }) as unknown as DialogRef<UnifiedUpgradeDialogResult>;

  beforeEach(() => {
    mockDialogService = mock<DialogService>();
    mockAccountService = mock<AccountService>();
    mockSyncService = mock<SyncService>();
    mockRouter = mock<Router>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();

    activeAccount$ = new BehaviorSubject<Account | null>(mockAccount);
    mockAccountService.activeAccount$ = activeAccount$;
    mockPlatformUtilsService.isSelfHost.mockReturnValue(false);

    TestBed.configureTestingModule({
      providers: [
        UpgradeFlowService,
        { provide: DialogService, useValue: mockDialogService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: SyncService, useValue: mockSyncService },
        { provide: Router, useValue: mockRouter },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
      ],
    });

    service = TestBed.inject(UpgradeFlowService);
  });

  describe("when self-hosted", () => {
    beforeEach(() => {
      mockPlatformUtilsService.isSelfHost.mockReturnValue(true);
    });

    it("navigates to the subscription page", async () => {
      await service.upgrade();

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/settings/subscription/premium"]);
      expect(mockDialogService.open).not.toHaveBeenCalled();
    });
  });

  describe("when not self-hosted", () => {
    it("returns early if no active account exists", async () => {
      activeAccount$.next(null);

      await service.upgrade();

      expect(mockDialogService.open).not.toHaveBeenCalled();
    });

    it("opens the upgrade dialog with the correct configuration", async () => {
      mockDialogService.open.mockReturnValue(
        dialogRefClosingWith({ status: UnifiedUpgradeDialogStatus.Closed }),
      );

      await service.upgrade();

      expect(mockDialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            account: mockAccount,
            planSelectionStepTitleOverride: "upgradeYourPlan",
            hideContinueWithoutUpgradingButton: true,
          },
        }),
      );
    });

    it("full syncs after upgrading to premium", async () => {
      mockDialogService.open.mockReturnValue(
        dialogRefClosingWith({ status: UnifiedUpgradeDialogStatus.UpgradedToPremium }),
      );

      await service.upgrade();

      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("navigates to the organization vault after upgrading to families", async () => {
      const organizationId = "org-123";
      mockDialogService.open.mockReturnValue(
        dialogRefClosingWith({
          status: UnifiedUpgradeDialogStatus.UpgradedToFamilies,
          organizationId,
        }),
      );

      await service.upgrade();

      expect(mockRouter.navigate).toHaveBeenCalledWith([`/organizations/${organizationId}/vault`]);
    });

    it("does nothing when the dialog closes without upgrading", async () => {
      mockDialogService.open.mockReturnValue(
        dialogRefClosingWith({ status: UnifiedUpgradeDialogStatus.Closed }),
      );

      await service.upgrade();

      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
