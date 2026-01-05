import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { BiometricStateService } from "@bitwarden/key-management";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../../libs/common/spec";

import {
  HasItemsNudgeService,
  EmptyVaultNudgeService,
  NewAccountNudgeService,
  AccountSecurityNudgeService,
  VaultSettingsImportNudgeService,
} from "./custom-nudges-services";
import { DefaultSingleNudgeService } from "./default-single-nudge.service";
import { NudgesService, NudgeType } from "./nudges.service";

describe("Vault Nudges Service", () => {
  let fakeStateProvider: FakeStateProvider;

  let testBed: TestBed;

  const nudgeServices = [
    EmptyVaultNudgeService,
    NewAccountNudgeService,
    AccountSecurityNudgeService,
  ];

  beforeEach(async () => {
    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));

    testBed = TestBed.configureTestingModule({
      imports: [],
      providers: [
        {
          provide: NudgesService,
        },
        {
          provide: DefaultSingleNudgeService,
        },
        {
          provide: StateProvider,
          useValue: fakeStateProvider,
        },
        {
          provide: HasItemsNudgeService,
          useValue: mock<HasItemsNudgeService>(),
        },
        {
          provide: NewAccountNudgeService,
          useValue: mock<NewAccountNudgeService>(),
        },
        {
          provide: EmptyVaultNudgeService,
          useValue: mock<EmptyVaultNudgeService>(),
        },
        {
          provide: AccountSecurityNudgeService,
          useValue: mock<AccountSecurityNudgeService>(),
        },
        {
          provide: VaultSettingsImportNudgeService,
          useValue: mock<VaultSettingsImportNudgeService>(),
        },
        {
          provide: ApiService,
          useValue: mock<ApiService>(),
        },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: AccountService,
          useValue: mock<AccountService>(),
        },
        {
          provide: LogService,
          useValue: mock<LogService>(),
        },
        {
          provide: PinServiceAbstraction,
          useValue: mock<PinServiceAbstraction>(),
        },
        {
          provide: VaultTimeoutSettingsService,
          useValue: mock<VaultTimeoutSettingsService>(),
        },
        {
          provide: BiometricStateService,
          useValue: mock<BiometricStateService>(),
        },
        {
          provide: PolicyService,
          useValue: mock<PolicyService>(),
        },
        {
          provide: OrganizationService,
          useValue: mock<OrganizationService>(),
        },
      ],
    });
  });

  describe("DefaultSingleNudgeService", () => {
    it("should return hasSpotlightDismissed === true when EmptyVaultNudge dismissed is true", async () => {
      const service = testBed.inject(DefaultSingleNudgeService);

      await service.setNudgeStatus(
        NudgeType.EmptyVaultNudge,
        { hasBadgeDismissed: true, hasSpotlightDismissed: true },
        "user-id" as UserId,
      );

      const result = await firstValueFrom(
        service.nudgeStatus$(NudgeType.EmptyVaultNudge, "user-id" as UserId),
      );
      expect(result).toEqual({ hasBadgeDismissed: true, hasSpotlightDismissed: true });
    });

    it("should return hasSpotlightDismissed === true when EmptyVaultNudge dismissed is false", async () => {
      const service = testBed.inject(DefaultSingleNudgeService);

      await service.setNudgeStatus(
        NudgeType.EmptyVaultNudge,
        { hasBadgeDismissed: false, hasSpotlightDismissed: false },
        "user-id" as UserId,
      );

      const result = await firstValueFrom(
        service.nudgeStatus$(NudgeType.EmptyVaultNudge, "user-id" as UserId),
      );
      expect(result).toEqual({ hasBadgeDismissed: false, hasSpotlightDismissed: false });
    });
  });

  describe("NudgesService", () => {
    it("should return true, the proper value from the custom nudge service nudgeStatus$", async () => {
      TestBed.overrideProvider(HasItemsNudgeService, {
        useValue: { nudgeStatus$: () => of(true) },
      });
      const service = testBed.inject(NudgesService);

      const result = await firstValueFrom(
        service.showNudgeStatus$(NudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(true);
    });

    it("should return false, the proper value for the custom nudge service nudgeStatus$", async () => {
      TestBed.overrideProvider(HasItemsNudgeService, {
        useValue: { nudgeStatus$: () => of(false) },
      });
      const service = testBed.inject(NudgesService);

      const result = await firstValueFrom(
        service.showNudgeStatus$(NudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(false);
    });

    it("should return showNudgeSpotlight$ false if hasSpotLightDismissed is true", async () => {
      TestBed.overrideProvider(HasItemsNudgeService, {
        useValue: {
          nudgeStatus$: () => of({ hasSpotlightDismissed: true, hasBadgeDismissed: true }),
        },
      });
      const service = testBed.inject(NudgesService);

      const result = await firstValueFrom(
        service.showNudgeSpotlight$(NudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(false);
    });

    it("should return showNudgeBadge$ false when hasBadgeDismissed is true", async () => {
      TestBed.overrideProvider(HasItemsNudgeService, {
        useValue: {
          nudgeStatus$: () => of({ hasSpotlightDismissed: true, hasBadgeDismissed: true }),
        },
      });
      const service = testBed.inject(NudgesService);

      const result = await firstValueFrom(
        service.showNudgeBadge$(NudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(false);
    });
  });

  describe("HasActiveBadges", () => {
    it("should return true if a nudgeType with hasBadgeDismissed === false", async () => {
      nudgeServices.forEach((service) => {
        TestBed.overrideProvider(service, {
          useValue: {
            nudgeStatus$: () => of({ hasBadgeDismissed: false, hasSpotlightDismissed: false }),
          },
        });
      });

      const service = testBed.inject(NudgesService);

      const result = await firstValueFrom(service.hasActiveBadges$("user-id" as UserId));

      expect(result).toBe(true);
    });
    it("should return false if all nudgeTypes have hasBadgeDismissed === true", async () => {
      nudgeServices.forEach((service) => {
        TestBed.overrideProvider(service, {
          useValue: {
            nudgeStatus$: () => of({ hasBadgeDismissed: true, hasSpotlightDismissed: false }),
          },
        });
      });
      const service = testBed.inject(NudgesService);

      const result = await firstValueFrom(service.hasActiveBadges$("user-id" as UserId));

      expect(result).toBe(false);
    });
  });
});
