import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import {
  PremiumCheckoutPending,
  PremiumCheckoutPendingService,
} from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { PremiumCheckoutProcessingComponent } from "../components/premium-checkout-processing/premium-checkout-processing.component";

import { PremiumCheckoutReturnService } from "./premium-checkout-return.service";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
};

describe("PremiumCheckoutReturnService", () => {
  const userId = "user-1" as UserId;
  const featureNameKey = "totpFeatureName";
  const upgradedToast = { variant: "success", message: "upgradedToPremium" };

  let service: PremiumCheckoutReturnService;
  let premiumCheckoutPendingService: MockProxy<PremiumCheckoutPendingService>;
  let syncService: MockProxy<SyncService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let dialogRef: MockProxy<DialogRef>;
  let premium$: BehaviorSubject<boolean>;
  let closed$: Subject<unknown>;
  let pendingState: PremiumCheckoutPending | null;

  beforeEach(() => {
    pendingState = null;
    premium$ = new BehaviorSubject(false);
    closed$ = new Subject();

    premiumCheckoutPendingService = mock<PremiumCheckoutPendingService>();
    premiumCheckoutPendingService.getCheckoutPending.mockImplementation(async () => pendingState);
    premiumCheckoutPendingService.clearCheckoutPending.mockImplementation(async () => {
      pendingState = null;
    });

    syncService = mock<SyncService>();
    syncService.fullSync.mockResolvedValue(true);

    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(premium$);

    dialogRef = mock<DialogRef>();
    Object.defineProperty(dialogRef, "closed", { value: closed$ });
    dialogRef.close.mockImplementation(async () => {
      closed$.next(undefined);
      closed$.complete();
      return { closed: true };
    });
    dialogService = mock<DialogService>();
    dialogService.open.mockReturnValue(dialogRef);

    toastService = mock<ToastService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        PremiumCheckoutReturnService,
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: PremiumCheckoutPendingService, useValue: premiumCheckoutPendingService },
        { provide: SyncService, useValue: syncService },
        { provide: ToastService, useValue: toastService },
      ],
    });
    service = TestBed.inject(PremiumCheckoutReturnService);
  });

  it("does nothing when no checkout is pending", async () => {
    await service.handleReturn(userId);

    expect(syncService.fullSync).not.toHaveBeenCalled();
    expect(premiumCheckoutPendingService.clearCheckoutPending).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  describe("a pending checkout without a feature name", () => {
    beforeEach(() => {
      pendingState = {};
    });

    it("syncs once, clears the pending checkout and shows nothing when Premium is not reflected", async () => {
      await service.handleReturn(userId);

      expect(syncService.fullSync).toHaveBeenCalledTimes(1);
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(premiumCheckoutPendingService.clearCheckoutPending).toHaveBeenCalledWith(userId);
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("still syncs once and clears when Premium is already reflected", async () => {
      premium$.next(true);

      await service.handleReturn(userId);

      expect(syncService.fullSync).toHaveBeenCalledTimes(1);
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(premiumCheckoutPendingService.clearCheckoutPending).toHaveBeenCalledWith(userId);
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
    });
  });

  describe("a pending checkout with a feature name", () => {
    beforeEach(() => {
      pendingState = { featureNameKey };
    });

    it("syncs once, clears, then shows the toast with no surface when Premium is already reflected", async () => {
      premium$.next(true);

      await service.handleReturn(userId);

      expect(syncService.fullSync).toHaveBeenCalledTimes(1);
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(syncService.fullSync.mock.invocationCallOrder[0]).toBeLessThan(
        toastService.showToast.mock.invocationCallOrder[0],
      );
      expect(toastService.showToast).toHaveBeenCalledTimes(1);
      expect(toastService.showToast).toHaveBeenCalledWith(upgradedToast);
      expect(
        premiumCheckoutPendingService.clearCheckoutPending.mock.invocationCallOrder[0],
      ).toBeLessThan(toastService.showToast.mock.invocationCallOrder[0]);
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("syncs once, then shows the toast with no surface when the sync brings Premium", async () => {
      syncService.fullSync.mockImplementation(async () => {
        premium$.next(true);
        return true;
      });

      await service.handleReturn(userId);

      expect(syncService.fullSync).toHaveBeenCalledTimes(1);
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(toastService.showToast).toHaveBeenCalledTimes(1);
      expect(toastService.showToast).toHaveBeenCalledWith(upgradedToast);
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("syncs once, clears, then opens the processing surface when Premium is still not reflected", async () => {
      await service.handleReturn(userId);

      expect(syncService.fullSync).toHaveBeenCalledTimes(1);
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledWith(
        PremiumCheckoutProcessingComponent,
        expect.objectContaining({ data: { featureNameKey } }),
      );
      expect(
        premiumCheckoutPendingService.clearCheckoutPending.mock.invocationCallOrder[0],
      ).toBeLessThan(dialogService.open.mock.invocationCallOrder[0]);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("still clears and opens the processing surface when the sync fails", async () => {
      syncService.fullSync.mockResolvedValue(false);

      await service.handleReturn(userId);

      expect(premiumCheckoutPendingService.clearCheckoutPending).toHaveBeenCalledWith(userId);
      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    describe("while the processing surface is open", () => {
      beforeEach(async () => {
        await service.handleReturn(userId);
      });

      it("shows the toast and closes the surface when Premium arrives for the handled user", () => {
        premium$.next(true);

        expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenLastCalledWith(
          userId,
        );
        expect(toastService.showToast).toHaveBeenCalledTimes(1);
        expect(toastService.showToast).toHaveBeenCalledWith(upgradedToast);
        expect(dialogRef.close).toHaveBeenCalledTimes(1);
      });

      it("shows no toast when the user dismisses it before Premium arrives", () => {
        closed$.next(undefined);
        closed$.complete();
        premium$.next(true);

        expect(toastService.showToast).not.toHaveBeenCalled();
        expect(dialogRef.close).not.toHaveBeenCalled();
      });
    });
  });

  describe("overlapping returns", () => {
    it("ignores a return that starts while another is in progress", async () => {
      const read = deferred<PremiumCheckoutPending | null>();
      premiumCheckoutPendingService.getCheckoutPending.mockReturnValueOnce(read.promise);

      const first = service.handleReturn(userId);
      await service.handleReturn(userId);
      read.resolve({ featureNameKey });
      await first;

      expect(premiumCheckoutPendingService.getCheckoutPending).toHaveBeenCalledTimes(1);
      expect(syncService.fullSync).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledTimes(1);
    });

    it("does nothing on a later return once the surface has opened", async () => {
      pendingState = { featureNameKey };

      await service.handleReturn(userId);
      await service.handleReturn(userId);

      expect(syncService.fullSync).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledTimes(1);
    });
  });

  describe("when a step throws", () => {
    it("rejects and lets the next return run when reading the pending checkout fails", async () => {
      const error = new Error("state read failed");
      premiumCheckoutPendingService.getCheckoutPending.mockRejectedValueOnce(error);

      await expect(service.handleReturn(userId)).rejects.toBe(error);

      pendingState = { featureNameKey };
      premium$.next(true);
      await service.handleReturn(userId);

      expect(toastService.showToast).toHaveBeenCalledTimes(1);
    });

    it("keeps the pending checkout when clearing fails, so the next return syncs again and opens the surface", async () => {
      const error = new Error("state write failed");
      pendingState = { featureNameKey };
      premiumCheckoutPendingService.clearCheckoutPending.mockRejectedValueOnce(error);

      await expect(service.handleReturn(userId)).rejects.toBe(error);

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();

      await service.handleReturn(userId);

      expect(syncService.fullSync).toHaveBeenCalledTimes(2);
      expect(dialogService.open).toHaveBeenCalledTimes(1);
    });
  });
});
