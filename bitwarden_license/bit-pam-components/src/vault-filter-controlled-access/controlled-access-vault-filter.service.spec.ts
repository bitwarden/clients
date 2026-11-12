import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, firstValueFrom, of, Subject } from "rxjs";

import { ACCESS_BADGE_LOOK, ENDING_SOON_THRESHOLD_MS } from "@bitwarden/bit-pam";
import type { AccessBadgeState } from "@bitwarden/bit-pam";
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
} from "@bitwarden/vault";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { MyAccessRequestsService } from "../services/my-access-requests.service";

import {
  ControlledAccessVaultFilterService,
  ENDING_SOON_FILTER_ID,
} from "./controlled-access-vault-filter.service";

const PAM_ORG = "org-1";
const PLAIN_ORG = "org-2";

function cipher(id: string, organizationId: string, partial: boolean): CipherViewLike {
  return { id, organizationId, partial } as unknown as CipherViewLike;
}

/** An active lease ending `inMs` from now. */
function activeIn(inMs: number): AccessBadgeState {
  return { kind: "active", expiresAt: new Date(Date.now() + inMs) };
}

describe("ControlledAccessVaultFilterService", () => {
  let service: ControlledAccessVaultFilterService;
  let enabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<{ id: string; usePam: boolean }[]>;
  // The caller's badges from their own requests: a cipher left out is one they hold nothing on.
  let badges$: BehaviorSubject<ReadonlyMap<string, AccessBadgeState>>;
  let ticks$: Subject<number>;

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<{ id: string; usePam: boolean }[]>([
      { id: PAM_ORG, usePam: true },
      { id: PLAIN_ORG, usePam: false },
    ]);
    ticks$ = new Subject<number>();
    badges$ = new BehaviorSubject<ReadonlyMap<string, AccessBadgeState>>(new Map());

    TestBed.configureTestingModule({
      providers: [
        ControlledAccessVaultFilterService,
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: MyAccessRequestsService, useValue: { badges$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccessBadgeTickerService, useValue: { ticks$ } },
      ],
    });

    service = TestBed.inject(ControlledAccessVaultFilterService);
  });

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
      ]);
    });

    it("offers nothing while the feature flag is off", async () => {
      enabled$.next(false);

      expect(await firstValueFrom(service.stateOptions$)).toEqual([]);
    });
  });

  describe("matches$", () => {
    it("maps each state option to the IDs of the rows in that state", async () => {
      badges$.next(
        new Map([
          ["pending", { kind: "pending" }],
          ["ready", { kind: "ready" }],
          ["active", activeIn(60 * 60 * 1000)],
          ["endingSoon", activeIn(ENDING_SOON_THRESHOLD_MS / 2)],
          ["lapsed", activeIn(-1000)],
        ]),
      );
      const rows = ["privileged", "pending", "ready", "active", "endingSoon", "lapsed"].map((id) =>
        cipher(id, PAM_ORG, true),
      );

      const matches = await firstValueFrom(service.matches$(rows));

      expect(matches).toEqual(
        new Map([
          [PRIVILEGED_FILTER_ID, new Set(["privileged"])],
          [READY_FILTER_ID, new Set(["ready"])],
          [PENDING_FILTER_ID, new Set(["pending"])],
          [ACTIVE_FILTER_ID, new Set(["active"])],
          [ENDING_SOON_FILTER_ID, new Set(["endingSoon"])],
        ]),
      );
    });

    it("moves an active lease from In use to Ending soon as the clock crosses the threshold", async () => {
      badges$.next(new Map([["lease", activeIn(ENDING_SOON_THRESHOLD_MS + 5000)]]));
      const emissions: ReadonlyMap<string, ReadonlySet<CipherId>>[] = [];
      const subscription = service
        .matches$([cipher("lease", PAM_ORG, true)])
        .subscribe((matches) => emissions.push(matches));

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

    it("follows the caller's badges as they change", async () => {
      const rows = [cipher("cipher-1", PAM_ORG, true)];
      const emissions: ReadonlyMap<string, ReadonlySet<CipherId>>[] = [];
      const subscription = service.matches$(rows).subscribe((matches) => emissions.push(matches));

      badges$.next(new Map([["cipher-1", { kind: "pending" }]]));
      subscription.unsubscribe();

      expect(emissions.map((matches) => matches.get(PENDING_FILTER_ID))).toEqual([
        new Set(),
        new Set(["cipher-1"]),
      ]);
    });

    it("leaves out unrestricted rows and rows outside a PAM organization", async () => {
      const matches = await firstValueFrom(
        service.matches$([
          cipher("gated", PAM_ORG, true),
          cipher("ungated", PAM_ORG, false),
          cipher("elsewhere", PLAIN_ORG, true),
        ]),
      );

      expect([...matches.values()].flatMap((ids) => [...ids])).toEqual(["gated"]);
    });

    it("does not read the caller's requests for a list without gated rows", async () => {
      await firstValueFrom(service.matches$([cipher("ungated", PAM_ORG, false)]));

      expect(badges$.observed).toBe(false);
    });
  });

  describe("sortRanks$", () => {
    it("ranks gated rows by the SDK's badge order: active, ready, pending, privileged", async () => {
      badges$.next(
        new Map([
          ["pending", { kind: "pending" }],
          ["ready", { kind: "ready" }],
          ["active", activeIn(60 * 60 * 1000)],
        ]),
      );
      const rows = ["privileged", "pending", "ready", "active"].map((id) =>
        cipher(id, PAM_ORG, true),
      );

      const ranks = await firstValueFrom(service.sortRanks$(rows));

      const order = [...ranks.entries()].sort(([, a], [, b]) => a - b).map(([id]) => id);
      expect(order).toEqual(["active", "ready", "pending", "privileged"]);
    });

    it("leaves out ungated rows and rows outside a PAM organization", async () => {
      const ranks = await firstValueFrom(
        service.sortRanks$([
          cipher("gated", PAM_ORG, true),
          cipher("ungated", PAM_ORG, false),
          cipher("elsewhere", PLAIN_ORG, true),
        ]),
      );

      expect([...ranks.keys()]).toEqual(["gated"]);
    });
  });
});
