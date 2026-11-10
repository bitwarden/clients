import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, Subject } from "rxjs";

import {
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
} from "@bitwarden/bit-pam";
import {
  AccessBadgeTickerService,
  ExtendLeaseDialogComponent,
} from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";

import { VaultRowAccessStateService } from "../vault-row-access-state/vault-row-access-state.service";

import { BrowserVaultRowAccessService } from "./browser-vault-row-access.service";

describe("BrowserVaultRowAccessService", () => {
  let service: BrowserVaultRowAccessService;
  let state$: BehaviorSubject<unknown>;
  let rowState: MockProxy<VaultRowAccessStateService>;
  let accessRequestSdk: MockProxy<AccessRequestSdkService>;
  let accessLeaseSdk: MockProxy<AccessLeaseSdkService>;
  let accessRefresh: MockProxy<AccessRefreshService>;
  let dialogService: MockProxy<DialogService>;
  let router: MockProxy<Router>;
  let toastService: MockProxy<ToastService>;
  let ticks$: Subject<number>;
  let pamEnabled$: BehaviorSubject<boolean>;
  let revealed$: BehaviorSubject<ReadonlyMap<string, unknown>>;
  let account$: BehaviorSubject<{ id: string }>;

  const gated = { id: "c1", name: "Amazon", partial: true } as unknown as CipherViewLike;
  const normal = { id: "c2", name: "Plain" } as unknown as CipherViewLike;

  const latest = () => firstValueFrom(service.status$(gated));
  const activeState = (extensionsAllowed = false) => ({
    badgeState: { active: { expiresAt: new Date(Date.now() + 8 * 3_600_000 - 500).toISOString() } },
    extensionsAllowed,
  });

  beforeEach(() => {
    state$ = new BehaviorSubject<unknown>({ badgeState: "privileged" });
    rowState = mock<VaultRowAccessStateService>();
    rowState.state$.mockReturnValue(state$ as any);
    accessRequestSdk = mock<AccessRequestSdkService>();
    accessLeaseSdk = mock<AccessLeaseSdkService>();
    accessRefresh = mock<AccessRefreshService>();
    dialogService = mock<DialogService>();
    router = mock<Router>();
    toastService = mock<ToastService>();
    ticks$ = new Subject<number>();
    pamEnabled$ = new BehaviorSubject(true);
    revealed$ = new BehaviorSubject<ReadonlyMap<string, unknown>>(new Map());
    account$ = new BehaviorSubject({ id: "u1" });

    TestBed.configureTestingModule({
      providers: [
        BrowserVaultRowAccessService,
        { provide: ConfigService, useValue: { getFeatureFlag$: () => pamEnabled$ } },
        { provide: AccountService, useValue: { activeAccount$: account$ } },
        { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
        { provide: DialogService, useValue: dialogService },
        { provide: Router, useValue: router },
        { provide: VaultRowAccessStateService, useValue: rowState },
        { provide: AccessRequestSdkService, useValue: accessRequestSdk },
        { provide: AccessLeaseSdkService, useValue: accessLeaseSdk },
        { provide: AccessRefreshService, useValue: accessRefresh },
        { provide: AccessBadgeTickerService, useValue: { ticks$ } },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: { t: (k: string, p?: string) => (p ? `${k}:${p}` : k) } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: RevealedCipherService, useValue: { revealed$: () => revealed$ } },
      ],
    });
    service = TestBed.inject(BrowserVaultRowAccessService);
  });

  describe("status$", () => {
    it.each([
      ["privileged", "request", "pamRequestToUse"],
      ["pending", "pending", "pamAccessBadgePending"],
      ["unavailable", "unavailable", "pamUnavailableToRequest"],
      ["ready", "ready", "pamAccessBadgeReady"],
    ])("maps the %s badge to the %s row status", async (badge, kind, label) => {
      state$.next({ badgeState: badge });

      expect(await latest()).toEqual({ kind, label, canExtend: false });
    });

    it("counts down an active lease and reports whether it can be extended", async () => {
      state$.next({
        badgeState: { active: { expiresAt: new Date(Date.now() + 8 * 3_600_000).toISOString() } },
        extensionsAllowed: true,
      });

      const status = await latest();

      expect(status?.kind).toBe("active");
      expect(status?.label).toMatch(/^pamAccessBadgeTimeLeft:/);
      expect(status?.canExtend).toBe(true);
    });

    it("re-reads the state once the lease has lapsed", async () => {
      state$.next({
        badgeState: { active: { expiresAt: new Date(Date.now() - 1000).toISOString() } },
      });

      const emissions: unknown[] = [];
      service.status$(gated).subscribe((s) => emissions.push(s));

      expect(emissions).toEqual([]);
      expect(rowState.invalidate).toHaveBeenCalledWith("c1");
    });

    describe("an unrestricted item held through a lease", () => {
      const leasedState = (ms: number) => ({
        badgeState: { active: { expiresAt: new Date(Date.now() + ms).toISOString() } },
      });

      it("counts down once its revealed copy is live", async () => {
        state$.next(leasedState(8 * 3_600_000));
        revealed$.next(new Map([["c2", {}]]));

        const status = await firstValueFrom(service.status$(normal));

        expect(status?.kind).toBe("active");
        expect(rowState.state$).toHaveBeenCalledWith("c2");
      });

      it("drops back to nothing when the reveal ends", () => {
        state$.next(leasedState(8 * 3_600_000));
        revealed$.next(new Map([["c2", {}]]));
        const emissions: unknown[] = [];
        service.status$(normal).subscribe((s) => emissions.push(s));

        revealed$.next(new Map());

        expect(emissions[emissions.length - 1]).toBeNull();
      });
    });

    describe("the countdown label", () => {
      const labelAt = async (ms: number) => {
        state$.next({
          badgeState: { active: { expiresAt: new Date(Date.now() + ms).toISOString() } },
        });
        return (await latest())?.label;
      };

      it("shows whole hours", async () => {
        expect(await labelAt(8 * 3_600_000 - 500)).toBe("pamAccessBadgeTimeLeft:8h");
      });

      it("shows minutes under an hour", async () => {
        expect(await labelAt(14 * 60_000 - 500)).toBe("pamAccessBadgeTimeLeft:14m");
      });

      it("shows less than a minute under a minute", async () => {
        expect(await labelAt(30_000)).toBe("pamAccessBadgeLessThanMinuteLeft");
      });

      it("ticks the label down as time passes", () => {
        state$.next({
          badgeState: { active: { expiresAt: new Date(Date.now() + 125_000).toISOString() } },
        });
        const labels: string[] = [];
        service.status$(gated).subscribe((s) => s && labels.push(s.label));

        ticks$.next(Date.now() + 10_000);

        expect(labels).toEqual(["pamAccessBadgeTimeLeft:3m", "pamAccessBadgeTimeLeft:2m"]);
      });
    });

    it("reports nothing for an item that is not restricted, without reading its state", async () => {
      expect(await firstValueFrom(service.status$(normal))).toBeNull();
      expect(rowState.state$).not.toHaveBeenCalled();
    });

    it("reports nothing while the Pam flag is off", async () => {
      pamEnabled$.next(false);

      expect(await latest()).toBeNull();
    });
  });

  describe("subtitle$", () => {
    const subtitle = (cipher = gated) => firstValueFrom(service.subtitle$(cipher));

    it.each([
      ["privileged", "pamRequestToUse"],
      ["pending", "pamAccessBadgePending"],
      ["unavailable", "pamUnavailableToRequest"],
      ["ready", "pamAccessBadgeReady"],
    ])("shows only the status of a %s row, hiding the username", async (badge, label) => {
      state$.next({ badgeState: badge });

      expect(await subtitle()).toBe(label);
    });

    it("shows the status before the username once access is active", async () => {
      state$.next(activeState());
      revealed$.next(new Map([["c1", { id: "c1", subTitle: "frodo@shire.com" }]]));

      expect(await subtitle()).toBe("pamAccessBadgeTimeLeft:8h • frodo@shire.com");
    });

    it("shows just the countdown while the revealed username is not yet available", async () => {
      state$.next(activeState());

      expect(await subtitle()).toBe("pamAccessBadgeTimeLeft:8h");
    });

    it("leaves an ungoverned row its own subtitle", async () => {
      expect(await subtitle(normal)).toBeNull();
    });
  });

  describe("rowActions", () => {
    const action = (id: string) => service.rowActions().find((a) => a.id === id)!;
    const shown = (cipher: CipherViewLike) =>
      service
        .rowActions()
        .filter((a) => a.show?.(cipher) ?? true)
        .map((a) => a.id);
    // A row reports its status once its icon or subtitle subscribes.
    const report = (cipher: CipherViewLike) => service.status$(cipher).subscribe();

    it("labels the actions", () => {
      expect(service.rowActions().map((a) => a.label)).toEqual([
        "pamStartLeaseButton",
        "pamRequestAccessButton",
        "pamExtendAccessMenuItem",
        "pamEndLeaseButton",
      ]);
    });

    it("offers nothing before the row reports a status", () => {
      expect(shown(gated)).toEqual([]);
    });

    it("offers an enabled Request access on a requestable gated row", () => {
      report(gated);

      expect(shown(gated)).toEqual(["pamRequestAccess"]);
      expect(action("pamRequestAccess").disabled?.(gated)).toBe(false);
    });

    it.each(["pending", "unavailable"])("disables Request access on a %s gated row", (badge) => {
      state$.next({ badgeState: badge });
      report(gated);

      expect(shown(gated)).toEqual(["pamRequestAccess"]);
      expect(action("pamRequestAccess").disabled?.(gated)).toBe(true);
    });

    it("offers Start access instead of Request access once the request is ready", () => {
      state$.next({ badgeState: "ready" });
      report(gated);

      expect(shown(gated)).toEqual(["pamStartAccess"]);
    });

    it("offers Extend and End access on the revealed row while access is active", () => {
      state$.next(activeState(true));
      revealed$.next(new Map([["c2", {}]]));
      report(normal);

      expect(shown(normal)).toEqual(["pamExtendAccess", "pamEndAccess"]);
    });

    it("omits Extend access when the lease cannot be extended", () => {
      state$.next(activeState(false));
      revealed$.next(new Map([["c2", {}]]));
      report(normal);

      expect(shown(normal)).toEqual(["pamEndAccess"]);
    });

    it("offers nothing on an ungoverned row", () => {
      report(normal);

      expect(shown(normal)).toEqual([]);
    });

    it("forgets the reported statuses when the account switches", () => {
      report(gated);

      account$.next({ id: "u2" });

      expect(shown(gated)).toEqual([]);
    });

    describe("a row that renders no icon or subtitle", () => {
      const afterMicrotask = () => Promise.resolve();

      it("reads its status once the menu asks", async () => {
        expect(shown(gated)).toEqual([]);

        await afterMicrotask();

        expect(shown(gated)).toEqual(["pamRequestAccess"]);
      });

      it("starts one read however often the menu asks", async () => {
        shown(gated);
        shown(gated);

        await afterMicrotask();
        shown(gated);

        expect(rowState.state$).toHaveBeenCalledTimes(1);
      });

      it("stops the read when the account switches", async () => {
        shown(gated);
        await afterMicrotask();

        account$.next({ id: "u2" });

        expect(state$.observed).toBe(false);
      });
    });

    it("requests access from the menu item", async () => {
      const row = { ...gated, type: { login: {} } } as unknown as CipherViewLike;

      await action("pamRequestAccess").run(row);

      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "c1", type: CipherType.Login },
      });
    });
  });

  describe("requestAccess", () => {
    it("opens the item, whose banner carries the request form", async () => {
      await service.requestAccess({ ...gated, type: { login: {} } } as unknown as CipherViewLike);

      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "c1", type: CipherType.Login },
      });
    });

    it("does nothing for a row without an id", async () => {
      await service.requestAccess({ name: "No id" } as unknown as CipherViewLike);

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("endAccess", () => {
    beforeEach(() => {
      accessRequestSdk.getCipherAccessState.mockResolvedValue({
        activeLease: { id: "lease-1" },
      } as any);
    });

    it("ends the lease after confirmation and announces the change", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.endAccess(gated);

      expect(accessLeaseSdk.endLease).toHaveBeenCalledWith("lease-1", { reason: undefined });
      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalledWith("c1");
    });

    it("does nothing when the member declines", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.endAccess(gated);

      expect(accessLeaseSdk.endLease).not.toHaveBeenCalled();
    });

    it("does nothing without an active lease", async () => {
      accessRequestSdk.getCipherAccessState.mockResolvedValue({ activeLease: undefined } as any);

      await service.endAccess(gated);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });
  });

  describe("extendAccess", () => {
    beforeEach(() => {
      accessRequestSdk.getCipherAccessState.mockResolvedValue({
        activeLease: { id: "lease-1" },
        maxExtensionDurationSeconds: 3600,
      } as any);
    });

    it("extends the lease with the dialog's request", async () => {
      const request = { durationSeconds: 900, reason: "audit" };
      const open = jest
        .spyOn(ExtendLeaseDialogComponent, "open")
        .mockReturnValue({ closed: of(request) } as any);
      accessLeaseSdk.extendLease.mockResolvedValue({ status: "approved" } as any);

      await service.extendAccess(gated);

      expect(open.mock.lastCall?.[1]).toEqual({ maxDurationSeconds: 3600 });
      expect(accessLeaseSdk.extendLease).toHaveBeenCalledWith("lease-1", request);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "pamExtendLeaseSuccess" }),
      );
      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalledWith("c1");
    });

    it("warns when the extension is denied", async () => {
      jest
        .spyOn(ExtendLeaseDialogComponent, "open")
        .mockReturnValue({ closed: of({ durationSeconds: 900, reason: "r" }) } as any);
      accessLeaseSdk.extendLease.mockResolvedValue({ status: "denied" } as any);

      await service.extendAccess(gated);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "warning", message: "pamExtendLeaseEnded" }),
      );
    });

    it("does nothing when the state carries no extension cap", async () => {
      accessRequestSdk.getCipherAccessState.mockResolvedValue({
        activeLease: { id: "lease-1" },
      } as any);
      const open = jest.spyOn(ExtendLeaseDialogComponent, "open");
      open.mockClear();

      await service.extendAccess(gated);

      expect(open).not.toHaveBeenCalled();
    });

    it("does nothing when the dialog is dismissed", async () => {
      jest
        .spyOn(ExtendLeaseDialogComponent, "open")
        .mockReturnValue({ closed: of(undefined) } as any);

      await service.extendAccess(gated);

      expect(accessLeaseSdk.extendLease).not.toHaveBeenCalled();
    });
  });

  describe("startAccess", () => {
    it("does nothing without an approved request", async () => {
      accessRequestSdk.getCipherAccessState.mockResolvedValue({ badgeState: "ready" } as any);

      await service.startAccess(gated);

      expect(accessRequestSdk.activateAccessRequest).not.toHaveBeenCalled();
    });
  });
});
