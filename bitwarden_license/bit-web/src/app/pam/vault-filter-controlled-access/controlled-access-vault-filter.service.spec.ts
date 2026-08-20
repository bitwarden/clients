import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import {
  ControlledAccessVaultFilterService,
  MY_REQUESTS_FILTER_ID,
  PRIVILEGED_FILTER_ID,
} from "./controlled-access-vault-filter.service";

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
    it("offers Privileged and My requests while Unavailable stays deferred", async () => {
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

    it("leaves the list untouched for an id from a milestone that has not shipped", async () => {
      const ciphers = [cipher("cipher-1", PAM_ORG, true)];

      const result = await firstValueFrom(service.narrow$("unavailable", ciphers));

      expect(result).toBe(ciphers);
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
});
