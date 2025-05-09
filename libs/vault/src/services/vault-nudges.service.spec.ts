import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { FakeStateProvider, mockAccountServiceWith } from "../../../common/spec";

import { HasItemsNudgeService, EmptyVaultNudgeService } from "./custom-nudges-services";
import { DefaultSingleNudgeService } from "./default-single-nudge.service";
import { VaultNudgesService, VaultNudgeType } from "./vault-nudges.service";

describe("Vault Nudges Service", () => {
  let fakeStateProvider: FakeStateProvider;

  let testBed: TestBed;
  const mockConfigService = {
    getFeatureFlag$: jest.fn().mockReturnValue(of(true)),
    getFeatureFlag: jest.fn().mockReturnValue(true),
  };

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
          provide: EmptyVaultNudgeService,
          useValue: mock<EmptyVaultNudgeService>(),
        },
        { provide: CipherService, useValue: mock<CipherService>() },
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
});
