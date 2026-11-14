import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, combineLatest, filter, firstValueFrom, map, of, Subject } from "rxjs";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  ACCESS_BADGE_LOOK,
  ENDING_SOON_THRESHOLD_MS,
} from "@bitwarden/bit-pam";
import type { CipherAccessStateView } from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  ACTIVE_FILTER_ID,
  PENDING_FILTER_ID,
  PRIVILEGED_FILTER_ID,
  READY_FILTER_ID,
  UNAVAILABLE_FILTER_ID,
} from "@bitwarden/vault";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

import { CONTROLLED_ACCESS_FILTER_LIVE_REFRESH } from "./controlled-access-filter-live-refresh";
import {
  ControlledAccessVaultFilterService,
  ENDING_SOON_FILTER_ID,
} from "./controlled-access-vault-filter.service";

const PAM_ORG = "org-1";
const PLAIN_ORG = "org-2";

function cipher(id: string, organizationId: string, partial: boolean): CipherViewLike {
  return { id, organizationId, partial } as unknown as CipherViewLike;
}

/** An active lease ending `inMs` from now, in the SDK's wire shape. */
function activeIn(inMs: number): unknown {
  return { active: { expiresAt: new Date(Date.now() + inMs).toISOString() } };
}

function accessState(badgeState: unknown): CipherAccessStateView {
  return { badgeState } as unknown as CipherAccessStateView;
}

describe("ControlledAccessVaultFilterService", () => {
  let service: ControlledAccessVaultFilterService;
  let enabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<{ id: string; usePam: boolean }[]>;
  let accessRequestSdkService: MockProxy<AccessRequestSdkService>;
  let ticks$: Subject<number>;
  let accessChanged$: Subject<string>;
  let accessRefreshService: MockProxy<AccessRefreshService>;

  function configure(liveRefresh?: boolean): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ControlledAccessVaultFilterService,
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccessBadgeTickerService, useValue: { ticks$ } },
        { provide: AccessRefreshService, useValue: accessRefreshService },
        ...(liveRefresh == null
          ? []
          : [{ provide: CONTROLLED_ACCESS_FILTER_LIVE_REFRESH, useValue: liveRefresh }]),
      ],
    });
    service = TestBed.inject(ControlledAccessVaultFilterService);
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<{ id: string; usePam: boolean }[]>([
      { id: PAM_ORG, usePam: true },
      { id: PLAIN_ORG, usePam: false },
    ]);
    ticks$ = new Subject<number>();
    accessRequestSdkService = mock<AccessRequestSdkService>();
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(accessState("privileged"));
    accessChanged$ = new Subject<string>();
    accessRefreshService = mock<AccessRefreshService>();
    accessRefreshService.accessChanged$.mockImplementation((cipherId?: string) =>
      accessChanged$.pipe(
        filter((changed) => cipherId == null || changed === cipherId),
        map((): void => undefined),
      ),
    );

    configure();
  });

  /** Lets the mocked SDK reads' promises settle. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  describe("stateOptions$", () => {
    // Icons are read off ACCESS_BADGE_LOOK rather than spelled again, so an icon the badge changes
    // cannot leave the chip showing the old one.
    it("offers one option per access state, labelled, iconed and coloured like its badge", async () => {
      expect(await firstValueFrom(service.stateOptions$)).toEqual([
        {
          id: PRIVILEGED_FILTER_ID,
          name: "pamAccessBadgePrivileged",
          icon: ACCESS_BADGE_LOOK.privileged.icon,
          tileVariant: "primary",
        },
        {
          id: READY_FILTER_ID,
          name: "pamAccessBadgeReady",
          icon: ACCESS_BADGE_LOOK.ready.icon,
          tileVariant: "success",
        },
        {
          id: PENDING_FILTER_ID,
          name: "pamAccessBadgePending",
          icon: ACCESS_BADGE_LOOK.pending.icon,
          tileVariant: "warning",
        },
        {
          id: ACTIVE_FILTER_ID,
          name: "pamControlledAccessFilterActive",
          icon: ACCESS_BADGE_LOOK.active.icon,
          tileVariant: "teal",
        },
        {
          id: ENDING_SOON_FILTER_ID,
          name: "pamControlledAccessFilterEndingSoon",
          icon: ACCESS_BADGE_LOOK.endingSoon.icon,
          tileVariant: "danger",
        },
        {
          id: UNAVAILABLE_FILTER_ID,
          name: "pamAccessBadgeUnavailable",
          icon: ACCESS_BADGE_LOOK.unavailable.icon,
          tileVariant: "gray",
        },
      ]);
    });

    it("offers nothing while the feature flag is off", async () => {
      enabled$.next(false);

      expect(await firstValueFrom(service.stateOptions$)).toEqual([]);
    });
  });

  describe("matches$", () => {
    it("maps each state option to the IDs of the rows in that state", async () => {
      const states: Record<string, unknown> = {
        privileged: "privileged",
        pending: "pending",
        ready: "ready",
        active: activeIn(60 * 60 * 1000),
        endingSoon: activeIn(ENDING_SOON_THRESHOLD_MS / 2),
        lapsed: activeIn(-1000),
      };
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        Promise.resolve(accessState(states[cipherId])),
      );
      const rows = Object.keys(states).map((id) => cipher(id, PAM_ORG, true));

      const matches = await firstValueFrom(service.matches$(rows));

      expect(matches).toEqual(
        new Map([
          [PRIVILEGED_FILTER_ID, new Set(["privileged"])],
          [READY_FILTER_ID, new Set(["ready"])],
          [PENDING_FILTER_ID, new Set(["pending"])],
          [ACTIVE_FILTER_ID, new Set(["active"])],
          [ENDING_SOON_FILTER_ID, new Set(["endingSoon"])],
          [UNAVAILABLE_FILTER_ID, new Set()],
        ]),
      );
    });

    it("moves an active lease from In use to Ending soon as the clock crosses the threshold", async () => {
      accessRequestSdkService.getCipherAccessState.mockResolvedValue(
        accessState(activeIn(ENDING_SOON_THRESHOLD_MS + 5000)),
      );
      const emissions: ReadonlyMap<string, ReadonlySet<CipherId>>[] = [];
      const subscription = service
        .matches$([cipher("lease", PAM_ORG, true)])
        .subscribe((matches) => emissions.push(matches));
      await new Promise((resolve) => setTimeout(resolve));

      ticks$.next(Date.now());
      ticks$.next(Date.now() + 10_000);
      subscription.unsubscribe();

      // The tick that changes nothing does not emit.
      expect(emissions).toHaveLength(2);
      expect(emissions[0].get(ACTIVE_FILTER_ID)).toEqual(new Set(["lease"]));
      expect(emissions[0].get(ENDING_SOON_FILTER_ID)).toEqual(new Set());
      expect(emissions[1].get(ACTIVE_FILTER_ID)).toEqual(new Set());
      expect(emissions[1].get(ENDING_SOON_FILTER_ID)).toEqual(new Set(["lease"]));
    });

    it("reads each restricted row's state once, shared across every option", async () => {
      const rows = [cipher("cipher-1", PAM_ORG, true), cipher("cipher-2", PAM_ORG, true)];

      await firstValueFrom(service.matches$(rows));

      expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(rows.length);
    });

    it("leaves out unrestricted rows, rows outside a PAM organization, and failed reads", async () => {
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        cipherId === "failed"
          ? Promise.reject(new Error("boom"))
          : Promise.resolve(accessState("privileged")),
      );

      const matches = await firstValueFrom(
        service.matches$([
          cipher("gated", PAM_ORG, true),
          cipher("ungated", PAM_ORG, false),
          cipher("elsewhere", PLAIN_ORG, true),
          cipher("failed", PAM_ORG, true),
        ]),
      );

      expect([...matches.values()].flatMap((ids) => [...ids])).toEqual(["gated"]);
      expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(2);
    });
  });

  describe("refreshing on access changes (PAM-567)", () => {
    const states: Record<string, unknown> = { "cipher-1": "privileged", "cipher-2": "privileged" };
    const rows = [cipher("cipher-1", PAM_ORG, true), cipher("cipher-2", PAM_ORG, true)];

    beforeEach(() => {
      states["cipher-1"] = "privileged";
      states["cipher-2"] = "privileged";
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        Promise.resolve(accessState(states[cipherId])),
      );
    });

    describe("with live refresh bound", () => {
      beforeEach(() => configure(true));

      it("moves a row to its new option when its access changes, without a new list", async () => {
        const emissions: ReadonlyMap<string, ReadonlySet<CipherId>>[] = [];
        const subscription = service.matches$(rows).subscribe((m) => emissions.push(m));
        await settle();

        states["cipher-1"] = "pending";
        accessChanged$.next("cipher-1");
        await settle();
        subscription.unsubscribe();

        const latest = emissions[emissions.length - 1];
        expect(emissions[0].get(PRIVILEGED_FILTER_ID)).toEqual(new Set(["cipher-1", "cipher-2"]));
        expect(latest.get(PRIVILEGED_FILTER_ID)).toEqual(new Set(["cipher-2"]));
        expect(latest.get(PENDING_FILTER_ID)).toEqual(new Set(["cipher-1"]));
      });

      it("re-reads only the row whose access changed", async () => {
        const subscription = service.matches$(rows).subscribe();
        await settle();
        accessRequestSdkService.getCipherAccessState.mockClear();

        accessChanged$.next("cipher-2");
        await settle();
        subscription.unsubscribe();

        expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(1);
        expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledWith("cipher-2");
      });

      it("keeps the column sort in step with the re-read state", async () => {
        const ranks: Map<string, number>[] = [];
        const subscription = service.sortRanks$(rows).subscribe((r) => ranks.push(r));
        await settle();

        states["cipher-1"] = "ready";
        accessChanged$.next("cipher-1");
        await settle();
        subscription.unsubscribe();

        // SORT_ORDER: active, ready, pending, unavailable, privileged.
        expect(ranks[ranks.length - 1].get("cipher-1")).toBe(1);
        expect(ranks[ranks.length - 1].get("cipher-2")).toBe(4);
      });
    });

    describe("with live refresh unbound", () => {
      it("reads each row once and ignores access changes", async () => {
        const emissions: ReadonlyMap<string, ReadonlySet<CipherId>>[] = [];
        const subscription = service.matches$(rows).subscribe((m) => emissions.push(m));
        await settle();

        states["cipher-1"] = "pending";
        accessChanged$.next("cipher-1");
        await settle();
        subscription.unsubscribe();

        expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(rows.length);
        expect(accessRefreshService.accessChanged$).not.toHaveBeenCalled();
        expect(emissions).toHaveLength(1);
      });
    });
  });

  describe("sortRanks$", () => {
    it("ranks gated rows by the SDK's badge order: active, ready, pending, unavailable, privileged", async () => {
      const states: Record<string, unknown> = {
        privileged: "privileged",
        unavailable: "unavailable",
        pending: "pending",
        ready: "ready",
        active: activeIn(60 * 60 * 1000),
      };
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        Promise.resolve(accessState(states[cipherId])),
      );
      const rows = Object.keys(states).map((id) => cipher(id, PAM_ORG, true));

      const ranks = await firstValueFrom(service.sortRanks$(rows));

      const order = [...ranks.entries()].sort(([, a], [, b]) => a - b).map(([id]) => id);
      expect(order).toEqual(["active", "ready", "pending", "unavailable", "privileged"]);
    });

    it("leaves out ungated rows and rows whose read failed", async () => {
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        cipherId === "failed"
          ? Promise.reject(new Error("boom"))
          : Promise.resolve(accessState("privileged")),
      );

      const ranks = await firstValueFrom(
        service.sortRanks$([
          cipher("gated", PAM_ORG, true),
          cipher("ungated", PAM_ORG, false),
          cipher("elsewhere", PLAIN_ORG, true),
          cipher("failed", PAM_ORG, true),
        ]),
      );

      expect([...ranks.keys()]).toEqual(["gated"]);
    });

    it("shares its reads with matches$ over the same rows", async () => {
      const rows = [cipher("cipher-1", PAM_ORG, true), cipher("cipher-2", PAM_ORG, true)];

      await firstValueFrom(combineLatest([service.matches$(rows), service.sortRanks$(rows)]));

      expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(rows.length);
    });
  });
});
