import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../common/spec";

import { VaultOnboardingNudgesService } from "./custom-nudges-services/vault-onboarding-nudges.service";
import {
  DefaultSingleNudgeService,
  VaultNudgesService,
  VaultNudgeType,
} from "./vault-nudges.service";

describe("End User Notification Center Service", () => {
  let fakeStateProvider: FakeStateProvider;

  let testBed: TestBed;

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
        {
          provide: VaultOnboardingNudgesService,
          useValue: mock<VaultOnboardingNudgesService>(),
        },
      ],
    });
  });

  describe("DefaultSingleNudgeService", () => {
    it("should return shouldShowNudge === false when IntroCaourselDismissal dismissed is true", async () => {
      const service = testBed.inject(DefaultSingleNudgeService);

      await service.setNudgeStatus(
        VaultNudgeType.IntroCarouselDismissal,
        true,
        "user-id" as UserId,
      );

      const result = await firstValueFrom(
        service.shouldShowNudge$(VaultNudgeType.IntroCarouselDismissal, "user-id" as UserId),
      );
      expect(result).toBe(false);
    });

    it("should return shouldShowNudge === true when IntroCaourselDismissal dismissed is false", async () => {
      const service = testBed.inject(DefaultSingleNudgeService);

      await service.setNudgeStatus(
        VaultNudgeType.IntroCarouselDismissal,
        false,
        "user-id" as UserId,
      );

      const result = await firstValueFrom(
        service.shouldShowNudge$(VaultNudgeType.IntroCarouselDismissal, "user-id" as UserId),
      );
      expect(result).toBe(true);
    });
  });

  describe("VaultNudgesService", () => {
    it("should return true, the proper value from the custom nudge service shouldShowNudge$", async () => {
      TestBed.overrideProvider(VaultOnboardingNudgesService, {
        useValue: { shouldShowNudge$: () => of(true) },
      });
      const service = testBed.inject(VaultNudgesService);

      const result = await firstValueFrom(
        service.showNudge$(VaultNudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(true);
    });

    it("should return false, the proper value for the custom nudge service shouldShowNudge$", async () => {
      TestBed.overrideProvider(VaultOnboardingNudgesService, {
        useValue: { shouldShowNudge$: () => of(false) },
      });
      const service = testBed.inject(VaultNudgesService);

      const result = await firstValueFrom(
        service.showNudge$(VaultNudgeType.HasVaultItems, "user-id" as UserId),
      );

      expect(result).toBe(false);
    });
  });
});
