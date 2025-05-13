import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { FakeStateProvider, mockAccountServiceWith } from "../../../common/spec";

import {
  HasItemsNudgeService,
  EmptyVaultNudgeService,
  DownloadBitwardenNudgeService,
} from "./custom-nudges-services";
import { DefaultSingleNudgeService } from "./default-single-nudge.service";
import { VaultNudgesService, VaultNudgeType } from "./vault-nudges.service";

describe("Vault Nudges Service", () => {
  let fakeStateProvider: FakeStateProvider;

  let testBed: TestBed;
  const mockConfigService = {
    getFeatureFlag$: jest.fn().mockReturnValue(of(true)),
    getFeatureFlag: jest.fn().mockReturnValue(true),
  };

  const vaultNudgeServices = [EmptyVaultNudgeService, DownloadBitwardenNudgeService];

  beforeEach(async () => {
    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));

    testBed = TestBed.configureTestingModule({
      imports: [],
      providers: [
        {
          provide: VaultNudgesService,
        },
        {
          provide: DefaultSingleNudgeService,
        },
        {
          provide: StateProvider,
          useValue: fakeStateProvider,
        },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: HasItemsNudgeService,
          useValue: mock<HasItemsNudgeService>(),
        },
        {
          provide: DownloadBitwardenNudgeService,
          useValue: mock<DownloadBitwardenNudgeService>(),
        },
        {
          provide: EmptyVaultNudgeService,
          useValue: mock<EmptyVaultNudgeService>(),
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
      ],
    });
  });

  describe("DefaultSingleNudgeService", () => {
    it("should return hasSpotlightDismissed === true when EmptyVaultNudge dismissed is true", async () => {
      const service = testBed.inject(DefaultSingleNudgeService);

      await service.setNudgeStatus(
        VaultNudgeType.EmptyVaultNudge,
        { hasBadgeDismissed: true, hasSpotlightDismissed: true },
        "user-id" as UserId,
      );

      const result = await firstValueFrom(
        service.nudgeStatus$(VaultNudgeType.EmptyVaultNudge, "user-id" as UserId),
      );
      expect(result).toEqual({ hasBadgeDismissed: true, hasSpotlightDismissed: true });
    });

    it("should return hasSpotlightDismissed === true when EmptyVaultNudge dismissed is false", async () => {
      const service = testBed.inject(DefaultSingleNudgeService);

      await service.setNudgeStatus(
        VaultNudgeType.EmptyVaultNudge,
        { hasBadgeDismissed: false, hasSpotlightDismissed: false },
        "user-id" as UserId,
      );

      const result = await firstValueFrom(
        service.nudgeStatus$(VaultNudgeType.EmptyVaultNudge, "user-id" as UserId),
      );
      expect(result).toEqual({ hasBadgeDismissed: false, hasSpotlightDismissed: false });
    });
  });

  describe("VaultNudgesService", () => {
    it("should return true, the proper value from the custom nudge service nudgeStatus$", async () => {
      TestBed.overrideProvider(HasItemsNudgeService, {
        useValue: { nudgeStatus$: () => of(true) },
      });
      const service = testBed.inject(VaultNudgesService);

      const result = await firstValueFrom(
        service.showNudge$(VaultNudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(true);
    });

    it("should return false, the proper value for the custom nudge service nudgeStatus$", async () => {
      TestBed.overrideProvider(HasItemsNudgeService, {
        useValue: { nudgeStatus$: () => of(false) },
      });
      const service = testBed.inject(VaultNudgesService);

      const result = await firstValueFrom(
        service.showNudge$(VaultNudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(false);
    });
  });

  describe("HasActiveBadges", () => {
    it("should return true if a nudgeType with hasBadgeDismissed === false", async () => {
      vaultNudgeServices.forEach((service) => {
        TestBed.overrideProvider(service, {
          useValue: {
            nudgeStatus$: () => of({ hasBadgeDismissed: false, hasSpotlightDismissed: false }),
          },
        });
      });

      const service = testBed.inject(VaultNudgesService);

      const result = await firstValueFrom(service.hasActiveBadges$("user-id" as UserId));

      expect(result).toBe(true);
    });
    it("should return false if all nudgeTypes have hasBadgeDismissed === true", async () => {
      vaultNudgeServices.forEach((service) => {
        TestBed.overrideProvider(service, {
          useValue: {
            nudgeStatus$: () => of({ hasBadgeDismissed: true, hasSpotlightDismissed: false }),
          },
        });
      });
      const service = testBed.inject(VaultNudgesService);

      const result = await firstValueFrom(service.hasActiveBadges$("user-id" as UserId));

      expect(result).toBe(false);
    });
  });
});
