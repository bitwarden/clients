import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/user-core";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../../../libs/common/spec";
import { NUDGE_DISMISSED_DISK_KEY, NudgeType } from "../nudges.service";

import { AutoConfirmNudgeService } from "./auto-confirm-nudge.service";

describe("AutoConfirmNudgeService", () => {
  let service: AutoConfirmNudgeService;
  let autoConfirmService: MockProxy<AutomaticUserConfirmationService>;
  let fakeStateProvider: FakeStateProvider;
  const userId = "user-id" as UserId;

  const mockAutoConfirmState = {
    enabled: true,
    showSetupDialog: false,
    showBrowserNotification: true,
  };

  beforeEach(() => {
    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    autoConfirmService = mock<AutomaticUserConfirmationService>();

    TestBed.configureTestingModule({
      providers: [
        AutoConfirmNudgeService,
        {
          provide: StateProvider,
          useValue: fakeStateProvider,
        },
        {
          provide: AutomaticUserConfirmationService,
          useValue: autoConfirmService,
        },
      ],
    });

    service = TestBed.inject(AutoConfirmNudgeService);
  });

  describe("nudgeStatus$", () => {
    it("should return all dismissed when user cannot manage auto-confirm", async () => {
      autoConfirmService.configuration$.mockReturnValue(new BehaviorSubject(mockAutoConfirmState));
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(false));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("should return all dismissed when showBrowserNotification is false", async () => {
      autoConfirmService.configuration$.mockReturnValue(
        new BehaviorSubject({
          ...mockAutoConfirmState,
          showBrowserNotification: false,
        }),
      );
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(true));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("should return not dismissed when showBrowserNotification is true and user can manage", async () => {
      autoConfirmService.configuration$.mockReturnValue(
        new BehaviorSubject({
          ...mockAutoConfirmState,
          showBrowserNotification: true,
        }),
      );
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(true));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: false,
        hasSpotlightDismissed: false,
      });
    });

    it("should return not dismissed when showBrowserNotification is undefined and user can manage", async () => {
      autoConfirmService.configuration$.mockReturnValue(
        new BehaviorSubject({
          ...mockAutoConfirmState,
          showBrowserNotification: undefined,
        }),
      );
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(true));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: false,
        hasSpotlightDismissed: false,
      });
    });

    it("should return stored nudge status when badge is already dismissed", async () => {
      await fakeStateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).update(() => ({
        [NudgeType.AutoConfirmNudge]: {
          hasBadgeDismissed: true,
          hasSpotlightDismissed: false,
        },
      }));

      autoConfirmService.configuration$.mockReturnValue(
        new BehaviorSubject({
          ...mockAutoConfirmState,
          showBrowserNotification: true,
        }),
      );
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(true));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: false,
      });
    });

    it("should return stored nudge status when spotlight is already dismissed", async () => {
      await fakeStateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).update(() => ({
        [NudgeType.AutoConfirmNudge]: {
          hasBadgeDismissed: false,
          hasSpotlightDismissed: true,
        },
      }));

      autoConfirmService.configuration$.mockReturnValue(
        new BehaviorSubject({
          ...mockAutoConfirmState,
          showBrowserNotification: true,
        }),
      );
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(true));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: false,
        hasSpotlightDismissed: true,
      });
    });

    it("should return stored nudge status when both badge and spotlight are already dismissed", async () => {
      await fakeStateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).update(() => ({
        [NudgeType.AutoConfirmNudge]: {
          hasBadgeDismissed: true,
          hasSpotlightDismissed: true,
        },
      }));

      autoConfirmService.configuration$.mockReturnValue(
        new BehaviorSubject({
          ...mockAutoConfirmState,
          showBrowserNotification: true,
        }),
      );
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(true));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("should prioritize user permissions over showBrowserNotification setting", async () => {
      await fakeStateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).update(() => ({
        [NudgeType.AutoConfirmNudge]: {
          hasBadgeDismissed: false,
          hasSpotlightDismissed: false,
        },
      }));

      autoConfirmService.configuration$.mockReturnValue(
        new BehaviorSubject({
          ...mockAutoConfirmState,
          showBrowserNotification: true,
        }),
      );
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(false));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });

    it("should respect stored dismissal even when user cannot manage auto-confirm", async () => {
      await fakeStateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).update(() => ({
        [NudgeType.AutoConfirmNudge]: {
          hasBadgeDismissed: true,
          hasSpotlightDismissed: false,
        },
      }));

      autoConfirmService.configuration$.mockReturnValue(new BehaviorSubject(mockAutoConfirmState));
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(new BehaviorSubject(false));

      const result = await firstValueFrom(service.nudgeStatus$(NudgeType.AutoConfirmNudge, userId));

      expect(result).toEqual({
        hasBadgeDismissed: true,
        hasSpotlightDismissed: true,
      });
    });
  });
});
