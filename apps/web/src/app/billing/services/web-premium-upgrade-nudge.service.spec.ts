import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject, throwError } from "rxjs";

import { PremiumUpgradeNudgeComponent } from "@bitwarden/angular/billing/components/premium-upgrade-nudge/premium-upgrade-nudge.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PremiumUpgradeNudgeOptions } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../individual/upgrade/unified-upgrade-dialog/unified-upgrade-dialog.component";

import { WebPremiumUpgradeNudgeService } from "./web-premium-upgrade-nudge.service";

describe("WebPremiumUpgradeNudgeService", () => {
  let service: WebPremiumUpgradeNudgeService;
  let accountService: MockProxy<AccountService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let dialogService: MockProxy<DialogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let router: MockProxy<Router>;
  let syncService: MockProxy<SyncService>;
  let logService: MockProxy<LogService>;

  let nudgeOpen: jest.SpyInstance;
  let unifiedOpen: jest.SpyInstance;
  let unifiedClosed: Subject<{ status: string } | undefined>;

  const account = { id: "user-id" as UserId } as Account;
  const options: PremiumUpgradeNudgeOptions = {
    titleKey: "title",
    descriptionKey: "description",
  };

  beforeEach(() => {
    accountService = mock<AccountService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    dialogService = mock<DialogService>();
    platformUtilsService = mock<PlatformUtilsService>();
    router = mock<Router>();
    syncService = mock<SyncService>();
    logService = mock<LogService>();

    accountService.activeAccount$ = of(account);
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
    platformUtilsService.isSelfHost.mockReturnValue(false);
    syncService.fullSync.mockResolvedValue(true);

    nudgeOpen = jest.spyOn(PremiumUpgradeNudgeComponent, "open").mockReturnValue({} as any);
    unifiedClosed = new Subject();
    unifiedOpen = jest
      .spyOn(UnifiedUpgradeDialogComponent, "open")
      .mockReturnValue({ closed: unifiedClosed.asObservable() } as any);

    TestBed.configureTestingModule({
      providers: [
        WebPremiumUpgradeNudgeService,
        { provide: AccountService, useValue: accountService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: DialogService, useValue: dialogService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: Router, useValue: router },
        { provide: SyncService, useValue: syncService },
        { provide: LogService, useValue: logService },
      ],
    });

    service = TestBed.inject(WebPremiumUpgradeNudgeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns true and opens no nudge for a Premium user", async () => {
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

    const result = await service.hasPremiumOrShowUpgradeNudge(options);

    expect(result).toBe(true);
    expect(nudgeOpen).not.toHaveBeenCalled();
  });

  it("opens the nudge and returns false for a free user", async () => {
    const result = await service.hasPremiumOrShowUpgradeNudge(options);

    expect(result).toBe(false);
    expect(nudgeOpen).toHaveBeenCalledWith(dialogService, {
      data: { options, upgrade: expect.any(Function) },
    });
  });

  it("rejects without returning true when the Premium read errors", async () => {
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(
      throwError(() => new Error("read failed")),
    );

    await expect(service.hasPremiumOrShowUpgradeNudge(options)).rejects.toThrow("read failed");
    expect(nudgeOpen).not.toHaveBeenCalled();
  });

  it("rejects when there is no active account", async () => {
    accountService.activeAccount$ = of(null);

    await expect(service.hasPremiumOrShowUpgradeNudge(options)).rejects.toThrow(
      "Null or undefined account",
    );
    expect(nudgeOpen).not.toHaveBeenCalled();
  });

  describe("upgrade handler", () => {
    const runUpgrade = async () => {
      await service.hasPremiumOrShowUpgradeNudge(options);
      const upgrade = nudgeOpen.mock.calls[0][1].data.upgrade as () => Promise<void>;
      await upgrade();
    };

    it("opens the in-app unified dialog for a cloud user", async () => {
      await runUpgrade();

      expect(unifiedOpen).toHaveBeenCalledWith(dialogService, {
        data: {
          account,
          planSelectionStepTitleOverride: "upgradeYourPlan",
          hideContinueWithoutUpgradingButton: true,
        },
      });
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("routes to the subscription page for a self-hosted deployment", async () => {
      platformUtilsService.isSelfHost.mockReturnValue(true);

      await runUpgrade();

      expect(router.navigate).toHaveBeenCalledWith(["settings/subscription/premium"]);
      expect(unifiedOpen).not.toHaveBeenCalled();
    });

    it("resolves without waiting for the unified dialog to close", async () => {
      await runUpgrade();

      // unifiedClosed never emitted, yet the handler above already resolved.
      expect(unifiedOpen).toHaveBeenCalled();
      expect(syncService.fullSync).not.toHaveBeenCalled();
    });

    it("runs a full sync after an upgrade to Premium", async () => {
      await runUpgrade();

      unifiedClosed.next({ status: UnifiedUpgradeDialogStatus.UpgradedToPremium });

      expect(syncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("runs a full sync after an upgrade to Families", async () => {
      await runUpgrade();

      unifiedClosed.next({ status: UnifiedUpgradeDialogStatus.UpgradedToFamilies });

      expect(syncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("does not sync when the unified dialog closes without an upgrade", async () => {
      await runUpgrade();

      unifiedClosed.next(undefined);

      expect(syncService.fullSync).not.toHaveBeenCalled();
    });

    it("logs when the post-upgrade sync fails", async () => {
      const error = new Error("sync failed");
      syncService.fullSync.mockRejectedValue(error);

      await runUpgrade();
      unifiedClosed.next({ status: UnifiedUpgradeDialogStatus.UpgradedToPremium });
      await Promise.resolve();

      expect(logService.error).toHaveBeenCalledWith("Post-upgrade sync failed", error);
    });
  });
});
