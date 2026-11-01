import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, combineLatest, firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  ACTIVE_FILTER_ID,
  MY_REQUESTS_FILTER_ID,
  PENDING_FILTER_ID,
  PRIVILEGED_FILTER_ID,
  READY_FILTER_ID,
  UNAVAILABLE_FILTER_ID,
} from "@bitwarden/vault";

import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { ControlledAccessVaultFilterService } from "./controlled-access-vault-filter.service";

const PAM_ORG = "org-1";
const PLAIN_ORG = "org-2";

function cipher(id: string, organizationId: string, partial: boolean): CipherViewLike {
  return { id, organizationId, partial } as unknown as CipherViewLike;
}

function accessState(badgeState: unknown): CipherAccessStateView {
  return { badgeState } as unknown as CipherAccessStateView;
}

describe("ControlledAccessVaultFilterService", () => {
  let service: ControlledAccessVaultFilterService;
  let enabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<{ id: string; usePam: boolean }[]>;
  let accessRequestSdkService: MockProxy<AccessRequestSdkService>;

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<{ id: string; usePam: boolean }[]>([
      { id: PAM_ORG, usePam: true },
      { id: PLAIN_ORG, usePam: false },
    ]);
    accessRequestSdkService = mock<AccessRequestSdkService>();
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(accessState("privileged"));

    TestBed.configureTestingModule({
      providers: [
        ControlledAccessVaultFilterService,
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });

    service = TestBed.inject(ControlledAccessVaultFilterService);
  });

  describe("options$", () => {
    it("offers the sidebar's state groups, Privileged and My requests", async () => {
      expect(await firstValueFrom(service.options$)).toEqual([
        { id: MY_REQUESTS_FILTER_ID, name: "pamTabMyRequests", icon: "bwi-lock-encrypted" },
        { id: PRIVILEGED_FILTER_ID, name: "pamAccessBadgePrivileged", icon: "bwi-key" },
      ]);
    });

    it("offers nothing when no organization in view carries the feature", async () => {
      organizations$.next([{ id: PLAIN_ORG, usePam: false }]);

      expect(await firstValueFrom(service.options$)).toEqual([]);
    });

    it("offers nothing while the feature flag is off", async () => {
      enabled$.next(false);

      expect(await firstValueFrom(service.options$)).toEqual([]);
    });
  });

  describe("stateOptions$", () => {
    it("offers one option per access state, labelled like its badge", async () => {
      expect(await firstValueFrom(service.stateOptions$)).toEqual([
        { id: PRIVILEGED_FILTER_ID, name: "pamAccessBadgePrivileged", icon: "bwi-key" },
        { id: PENDING_FILTER_ID, name: "pamAccessBadgePending", icon: "bwi-clock" },
        { id: READY_FILTER_ID, name: "pamAccessBadgeReady", icon: "bwi-check" },
        { id: ACTIVE_FILTER_ID, name: "pamControlledAccessFilterActive", icon: "bwi-unlock" },
        { id: UNAVAILABLE_FILTER_ID, name: "pamAccessBadgeUnavailable", icon: "bwi-lock" },
      ]);
    });

    it("offers nothing while the feature flag is off", async () => {
      enabled$.next(false);

      expect(await firstValueFrom(service.stateOptions$)).toEqual([]);
    });
  });

  describe("narrow$", () => {
    it("keeps only the gated rows the SDK reports as privileged", async () => {
      const privileged = cipher("cipher-1", PAM_ORG, true);
      const pending = cipher("cipher-2", PAM_ORG, true);
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        Promise.resolve(accessState(cipherId === "cipher-1" ? "privileged" : "pending")),
      );

      const result = await firstValueFrom(
        service.narrow$(PRIVILEGED_FILTER_ID, [privileged, pending]),
      );

      expect(result).toEqual([privileged]);
    });

    it("drops ungated rows without asking the SDK about them", async () => {
      const ungated = cipher("cipher-1", PAM_ORG, false);

      const result = await firstValueFrom(service.narrow$(PRIVILEGED_FILTER_ID, [ungated]));

      expect(result).toEqual([]);
      expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("does not read access state for an organization that cannot have access rules", async () => {
      const elsewhere = cipher("cipher-1", PLAIN_ORG, true);

      const result = await firstValueFrom(service.narrow$(PRIVILEGED_FILTER_ID, [elsewhere]));

      expect(result).toEqual([]);
      expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("excludes a row whose access-state read failed", async () => {
      accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("boom"));

      const result = await firstValueFrom(
        service.narrow$(PRIVILEGED_FILTER_ID, [cipher("cipher-1", PAM_ORG, true)]),
      );

      expect(result).toEqual([]);
    });

    it("leaves the list untouched for an option it does not currently offer", async () => {
      const ciphers = [cipher("cipher-1", PAM_ORG, true), cipher("cipher-2", PLAIN_ORG, false)];
      enabled$.next(false);

      const result = await firstValueFrom(service.narrow$(PRIVILEGED_FILTER_ID, ciphers));

      expect(result).toBe(ciphers);
      expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("leaves the list untouched for an id it has never offered", async () => {
      const ciphers = [cipher("cipher-1", PAM_ORG, true)];

      const result = await firstValueFrom(service.narrow$("retired", ciphers));

      expect(result).toBe(ciphers);
    });

    it.each([
      [PENDING_FILTER_ID, "pending"],
      [READY_FILTER_ID, "ready"],
      [UNAVAILABLE_FILTER_ID, "unavailable"],
    ])("keeps only the rows in state %s under its table option", async (optionId, badgeState) => {
      const match = cipher("cipher-1", PAM_ORG, true);
      const other = cipher("cipher-2", PAM_ORG, true);
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        Promise.resolve(accessState(cipherId === "cipher-1" ? badgeState : "privileged")),
      );

      const result = await firstValueFrom(service.narrow$(optionId, [match, other]));

      expect(result).toEqual([match]);
    });

    it("keeps a row holding an active lease under the Active table option", async () => {
      const active = cipher("cipher-1", PAM_ORG, true);
      accessRequestSdkService.getCipherAccessState.mockResolvedValue(
        accessState({ active: { expiresAt: "2026-08-20T12:00:00.000Z" } }),
      );

      const result = await firstValueFrom(service.narrow$(ACTIVE_FILTER_ID, [active]));

      expect(result).toEqual([active]);
    });

    it("reads each row's state once across every option narrowed over the same rows", async () => {
      const rows = [cipher("cipher-1", PAM_ORG, true), cipher("cipher-2", PAM_ORG, true)];

      await firstValueFrom(
        combineLatest([
          service.narrow$(PRIVILEGED_FILTER_ID, rows),
          service.narrow$(PENDING_FILTER_ID, rows),
          service.narrow$(READY_FILTER_ID, rows),
        ]),
      );

      expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(rows.length);
    });

    it.each(["pending", "ready"])(
      "keeps a gated row the SDK reports as %s under My requests",
      async (badgeState) => {
        const requested = cipher("cipher-1", PAM_ORG, true);
        accessRequestSdkService.getCipherAccessState.mockResolvedValue(accessState(badgeState));

        const result = await firstValueFrom(service.narrow$(MY_REQUESTS_FILTER_ID, [requested]));

        expect(result).toEqual([requested]);
      },
    );

    it("keeps a gated row holding an active lease under My requests", async () => {
      const active = cipher("cipher-1", PAM_ORG, true);
      accessRequestSdkService.getCipherAccessState.mockResolvedValue(
        accessState({ active: { expiresAt: "2026-08-20T12:00:00.000Z" } }),
      );

      const result = await firstValueFrom(service.narrow$(MY_REQUESTS_FILTER_ID, [active]));

      expect(result).toEqual([active]);
    });

    it("drops a row that is merely privileged from My requests", async () => {
      const result = await firstValueFrom(
        service.narrow$(MY_REQUESTS_FILTER_ID, [cipher("cipher-1", PAM_ORG, true)]),
      );

      expect(result).toEqual([]);
    });
  });

  describe("matches$", () => {
    it("maps each state option to the IDs of the rows in that state", async () => {
      const states: Record<string, unknown> = {
        privileged: "privileged",
        pending: "pending",
        ready: "ready",
        active: { active: { expiresAt: "2026-08-20T12:00:00.000Z" } },
      };
      accessRequestSdkService.getCipherAccessState.mockImplementation((cipherId: string) =>
        Promise.resolve(accessState(states[cipherId])),
      );
      const rows = Object.keys(states).map((id) => cipher(id, PAM_ORG, true));

      const matches = await firstValueFrom(service.matches$(rows));

      expect(matches).toEqual(
        new Map([
          [PRIVILEGED_FILTER_ID, new Set(["privileged"])],
          [PENDING_FILTER_ID, new Set(["pending"])],
          [READY_FILTER_ID, new Set(["ready"])],
          [ACTIVE_FILTER_ID, new Set(["active"])],
          [UNAVAILABLE_FILTER_ID, new Set()],
        ]),
      );
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

  describe("sortRanks$", () => {
    it("ranks gated rows by the SDK's badge order: active, ready, pending, unavailable, privileged", async () => {
      const states: Record<string, unknown> = {
        privileged: "privileged",
        unavailable: "unavailable",
        pending: "pending",
        ready: "ready",
        active: { active: { expiresAt: "2026-08-20T12:00:00.000Z" } },
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

    it("shares its reads with narrow$ over the same rows", async () => {
      const rows = [cipher("cipher-1", PAM_ORG, true), cipher("cipher-2", PAM_ORG, true)];

      await firstValueFrom(
        combineLatest([service.narrow$(PRIVILEGED_FILTER_ID, rows), service.sortRanks$(rows)]),
      );

      expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(rows.length);
    });
  });
});
