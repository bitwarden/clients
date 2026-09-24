import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/user-core";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../../../libs/common/spec";
import { NUDGE_DISMISSED_DISK_KEY, NudgeType } from "../nudges.service";
import { VaultProfileService } from "../vault-profile.service";

import {
  VFO1_GA_RELEASE_DATE,
  VFO1_ONBOARDING_WINDOW_MONTHS,
  Vfo1OnboardingNudgeService,
} from "./vfo1-onboarding-nudge.service";

/** Shifts a copy of the GA release date by the given number of days. */
function gaDatePlusDays(days: number): Date {
  const date = new Date(VFO1_GA_RELEASE_DATE);
  date.setDate(date.getDate() + days);
  return date;
}

/** Shifts a copy of the GA release date by the given number of months. */
function gaDatePlusMonths(months: number): Date {
  const date = new Date(VFO1_GA_RELEASE_DATE);
  date.setMonth(date.getMonth() + months);
  return date;
}

describe("Vfo1OnboardingNudgeService", () => {
  let service: Vfo1OnboardingNudgeService;
  let vaultProfileService: MockProxy<VaultProfileService>;
  let logService: MockProxy<LogService>;
  let fakeStateProvider: FakeStateProvider;
  const userId = "user-id" as UserId;
  const nudgeType = NudgeType.Vfo1NewExperience;

  const preGaAccount = gaDatePlusDays(-30);
  const insideWindow = gaDatePlusMonths(1);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(insideWindow);

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    vaultProfileService = mock<VaultProfileService>();
    logService = mock<LogService>();

    vaultProfileService.getProfileCreationDate.mockResolvedValue(preGaAccount);

    TestBed.configureTestingModule({
      providers: [
        Vfo1OnboardingNudgeService,
        { provide: StateProvider, useValue: fakeStateProvider },
        { provide: VaultProfileService, useValue: vaultProfileService },
        { provide: LogService, useValue: logService },
      ],
    });

    service = TestBed.inject(Vfo1OnboardingNudgeService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("nudgeStatus$", () => {
    it("reports the nudge as active for a pre-GA account inside the onboarding window", async () => {
      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual({
        hasBadgeDismissed: false,
        hasSpotlightDismissed: false,
      });
    });

    it("reports the nudge as dismissed for an account created after the GA release date", async () => {
      vaultProfileService.getProfileCreationDate.mockResolvedValue(gaDatePlusDays(1));

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("reports the nudge as dismissed for an account created exactly on the GA release date", async () => {
      vaultProfileService.getProfileCreationDate.mockResolvedValue(new Date(VFO1_GA_RELEASE_DATE));

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("reports the nudge as dismissed once the onboarding window has closed", async () => {
      jest.setSystemTime(gaDatePlusMonths(VFO1_ONBOARDING_WINDOW_MONTHS + 1));

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("reports the nudge as active on the last day of the onboarding window", async () => {
      const lastDay = gaDatePlusMonths(VFO1_ONBOARDING_WINDOW_MONTHS);
      lastDay.setDate(lastDay.getDate() - 1);
      jest.setSystemTime(lastDay);

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual({
        hasBadgeDismissed: false,
        hasSpotlightDismissed: false,
      });
    });

    it("reports the nudge as dismissed once the user has dismissed it", async () => {
      await fakeStateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).update(() => ({
        [nudgeType]: { hasBadgeDismissed: true, hasSpotlightDismissed: true },
      }));

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("reports the nudge as dismissed when the profile creation date cannot be read", async () => {
      vaultProfileService.getProfileCreationDate.mockRejectedValue(new Error("network error"));

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
      expect(logService.error).toHaveBeenCalledWith("Error getting profile creation date");
    });
  });

  describe("setNudgeStatus", () => {
    it("persists the dismissal to NUDGES_DISK", async () => {
      await service.setNudgeStatus(
        nudgeType,
        { hasBadgeDismissed: true, hasSpotlightDismissed: true },
        userId,
      );

      const stored = await firstValueFrom(
        fakeStateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).state$,
      );

      expect(stored?.[nudgeType]).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("keeps the dismissal across a state reload, because the key never clears", () => {
      expect(NUDGE_DISMISSED_DISK_KEY.clearOn).toEqual([]);
    });
  });
});
