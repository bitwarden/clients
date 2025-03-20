import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../common/spec";

import {
  OnboardingNudgesService,
  ONBOARDING_NUDGES_KEY,
  OnboardingNudges,
} from "./onboarding-nudges.service";

describe("End User Notification Center Service", () => {
  let fakeStateProvider: FakeStateProvider;

  const mockApiSend = jest.fn();

  let testBed: TestBed;

  beforeEach(async () => {
    mockApiSend.mockClear();

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));

    testBed = TestBed.configureTestingModule({
      imports: [],
      providers: [
        OnboardingNudgesService,
        {
          provide: StateProvider,
          useValue: fakeStateProvider,
        },
        {
          provide: ApiService,
          useValue: {
            send: mockApiSend,
          },
        },
      ],
    });
  });

  describe("getOnboardinngNudgesState$", () => {
    it("should return notifications from state when not null", async () => {
      fakeStateProvider.singleUser.mockFor("user-id" as UserId, ONBOARDING_NUDGES_KEY, {
        introCarouselDismissal: true,
      } as OnboardingNudges);

      const { getOnboardinngNudgesState$ } = testBed.inject(OnboardingNudgesService);

      const result = await firstValueFrom(getOnboardinngNudgesState$("user-id" as UserId));

      expect(result?.introCarouselDismissal).toBe(true);
      expect(mockApiSend).not.toHaveBeenCalled();
    });
  });
});
