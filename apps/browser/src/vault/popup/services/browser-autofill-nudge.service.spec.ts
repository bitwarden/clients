import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { NudgeStatus, NudgeType } from "@bitwarden/angular/vault";
import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../../../libs/common/spec";
import { BrowserApi } from "../../../platform/browser/browser-api";

import { BrowserAutofillNudgeService } from "./browser-autofill-nudge.service";

describe("BrowserAutofillNudgeService", () => {
  let service: BrowserAutofillNudgeService;
  let vaultProfileService: MockProxy<VaultProfileService>;
  let fakeStateProvider: FakeStateProvider;

  const userId = "test-user-id" as UserId;
  const nudgeType = NudgeType.AutofillNudge;

  const notDismissedStatus: NudgeStatus = {
    hasBadgeDismissed: false,
    hasSpotlightDismissed: false,
  };

  const dismissedStatus: NudgeStatus = {
    hasBadgeDismissed: true,
    hasSpotlightDismissed: true,
  };

  // Set profile creation date to now (new account, within 30 days)
  const recentProfileDate = new Date();

  beforeEach(() => {
    vaultProfileService = mock<VaultProfileService>();
    vaultProfileService.getProfileCreationDate.mockResolvedValue(recentProfileDate);

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith(userId));

    TestBed.configureTestingModule({
      providers: [
        BrowserAutofillNudgeService,
        {
          provide: VaultProfileService,
          useValue: vaultProfileService,
        },
        {
          provide: StateProvider,
          useValue: fakeStateProvider,
        },
        {
          provide: LogService,
          useValue: mock<LogService>(),
        },
      ],
    });

    service = TestBed.inject(BrowserAutofillNudgeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("nudgeStatus$", () => {
    it("returns parent status when browser client is Unknown", async () => {
      jest
        .spyOn(BrowserApi, "getBrowserClientVendor")
        .mockReturnValue(BrowserClientVendors.Unknown);
      jest.spyOn(BrowserApi, "browserAutofillSettingsOverridden").mockResolvedValue(true);

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual(notDismissedStatus);
    });

    it("returns parent status when browser autofill is not overridden", async () => {
      jest.spyOn(BrowserApi, "getBrowserClientVendor").mockReturnValue(BrowserClientVendors.Chrome);
      jest.spyOn(BrowserApi, "browserAutofillSettingsOverridden").mockResolvedValue(false);

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual(notDismissedStatus);
    });

    it("returns dismissed status when browser autofill is overridden", async () => {
      jest.spyOn(BrowserApi, "getBrowserClientVendor").mockReturnValue(BrowserClientVendors.Chrome);
      jest.spyOn(BrowserApi, "browserAutofillSettingsOverridden").mockResolvedValue(true);

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual(dismissedStatus);
    });

    it("preserves parent dismissed status when account is older than 30 days", async () => {
      // Set profile creation date to more than 30 days ago
      const oldProfileDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vaultProfileService.getProfileCreationDate.mockResolvedValue(oldProfileDate);

      jest.spyOn(BrowserApi, "getBrowserClientVendor").mockReturnValue(BrowserClientVendors.Chrome);
      jest.spyOn(BrowserApi, "browserAutofillSettingsOverridden").mockResolvedValue(false);

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual(dismissedStatus);
    });

    it("combines parent dismissed and browser autofill overridden status", async () => {
      // Set profile creation date to more than 30 days ago (parent dismisses)
      const oldProfileDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vaultProfileService.getProfileCreationDate.mockResolvedValue(oldProfileDate);

      jest.spyOn(BrowserApi, "getBrowserClientVendor").mockReturnValue(BrowserClientVendors.Chrome);
      jest.spyOn(BrowserApi, "browserAutofillSettingsOverridden").mockResolvedValue(true);

      const result = await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(result).toEqual(dismissedStatus);
    });

    it.each([
      BrowserClientVendors.Chrome,
      BrowserClientVendors.Edge,
      BrowserClientVendors.Opera,
      BrowserClientVendors.Vivaldi,
    ])("checks browser autofill settings for %s browser", async (browserVendor) => {
      const getBrowserClientVendorSpy = jest
        .spyOn(BrowserApi, "getBrowserClientVendor")
        .mockReturnValue(browserVendor);
      const browserAutofillSettingsOverriddenSpy = jest
        .spyOn(BrowserApi, "browserAutofillSettingsOverridden")
        .mockResolvedValue(true);

      await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(getBrowserClientVendorSpy).toHaveBeenCalledWith(window);
      expect(browserAutofillSettingsOverriddenSpy).toHaveBeenCalled();
    });

    it("does not check browser autofill settings for Unknown browser", async () => {
      jest
        .spyOn(BrowserApi, "getBrowserClientVendor")
        .mockReturnValue(BrowserClientVendors.Unknown);
      const browserAutofillSettingsOverriddenSpy = jest
        .spyOn(BrowserApi, "browserAutofillSettingsOverridden")
        .mockResolvedValue(true);

      await firstValueFrom(service.nudgeStatus$(nudgeType, userId));

      expect(browserAutofillSettingsOverriddenSpy).not.toHaveBeenCalled();
    });
  });
});
