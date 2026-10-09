import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerSettings } from "@bitwarden/common/platform/models/domain/server-settings";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import {
  NewExperienceDialogComponent,
  NewExperienceDialogResult,
} from "../components/new-experience-dialog/new-experience-dialog.component";

import { NewExperienceDialogService } from "./new-experience-dialog.service";

describe("NewExperienceDialogService", () => {
  const userId = "user-1" as UserId;
  const params = {
    lightImgSrc: "light.png",
    darkImgSrc: "dark.png",
  };

  let service: NewExperienceDialogService;
  let configService: MockProxy<ConfigService>;
  let nudgesService: MockProxy<NudgesService>;
  let serverSettings$: BehaviorSubject<ServerSettings>;
  let dialogService: MockProxy<DialogService>;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    configService = mock<ConfigService>();
    nudgesService = mock<NudgesService>();
    dialogService = mock<DialogService>();
    serverSettings$ = new BehaviorSubject(new ServerSettings());

    configService.getFeatureFlag$.mockImplementation((flag) =>
      of(flag === FeatureFlag.VFO1Foundation),
    );
    Object.defineProperty(configService, "serverSettings$", { value: serverSettings$ });
    nudgesService.showNudgeSpotlight$.mockReturnValue(of(true));

    openSpy = jest
      .spyOn(NewExperienceDialogComponent, "open")
      .mockResolvedValue(NewExperienceDialogResult.Dismissed);

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: DialogService, useValue: dialogService },
        { provide: NudgesService, useValue: nudgesService },
      ],
    });

    service = TestBed.inject(NewExperienceDialogService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it("opens the dialog with the caller's screenshots and the account", async () => {
    await expect(service.conditionallyOpen(userId, params)).resolves.toBe(
      NewExperienceDialogResult.Dismissed,
    );

    expect(openSpy).toHaveBeenCalledWith(dialogService, { ...params, userId });
  });

  it("reads the nudge for the account being shown the dialog", async () => {
    await service.conditionallyOpen(userId, params);

    expect(nudgesService.showNudgeSpotlight$).toHaveBeenCalledWith(
      NudgeType.Vfo1NewExperience,
      userId,
    );
  });

  it("leaves dismissing the nudge to the dialog's actions", async () => {
    await service.conditionallyOpen(userId, params);

    expect(nudgesService.dismissNudge).not.toHaveBeenCalled();
  });

  describe("when the dialog should not open", () => {
    const expectSkipped = async () => {
      await expect(service.conditionallyOpen(userId, params)).resolves.toBeNull();

      expect(openSpy).not.toHaveBeenCalled();
      expect(nudgesService.dismissNudge).not.toHaveBeenCalled();
    };

    it("skips it when the vfo1-foundation flag is off", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));

      await expectSkipped();
    });

    it("skips it when the server suppresses onboarding interstitials", async () => {
      serverSettings$.next(new ServerSettings({ suppressOnboardingInterstitials: true }));

      await expectSkipped();
    });

    it("skips it when the nudge is already dismissed", async () => {
      nudgesService.showNudgeSpotlight$.mockReturnValue(of(false));

      await expectSkipped();
    });
  });
});
