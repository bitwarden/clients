import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

import { CoachmarkService } from "../components/coachmark/coachmark.service";

import { NewItemTypesAnnouncementService } from "./new-item-types-announcement.service";

describe("NewItemTypesAnnouncementService", () => {
  const userId = "user-id" as UserId;
  let service: NewItemTypesAnnouncementService;
  let nudgesService: MockProxy<NudgesService>;
  let flag$: BehaviorSubject<boolean>;
  let restricted$: BehaviorSubject<RestrictedCipherType[]>;
  let spotlightPending$: BehaviorSubject<boolean>;
  let badgePending$: BehaviorSubject<boolean>;
  let tourRunning: WritableSignal<boolean>;

  const restrict = (...types: CipherType[]) =>
    restricted$.next(
      types.map<RestrictedCipherType>((cipherType) => ({ cipherType, allowViewOrgIds: [] })),
    );

  beforeEach(() => {
    flag$ = new BehaviorSubject(true);
    restricted$ = new BehaviorSubject<RestrictedCipherType[]>([]);
    spotlightPending$ = new BehaviorSubject(true);
    badgePending$ = new BehaviorSubject(true);
    tourRunning = signal(false);

    nudgesService = mock<NudgesService>();
    nudgesService.showNudgeSpotlight$.mockReturnValue(spotlightPending$);
    nudgesService.showNudgeBadge$.mockReturnValue(badgePending$);

    const accountService = mockAccountServiceWith(userId);

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => flag$ } },
        { provide: NudgesService, useValue: nudgesService },
        { provide: RestrictedItemTypesService, useValue: { restricted$ } },
        { provide: StateProvider, useValue: new FakeStateProvider(accountService) },
        { provide: CoachmarkService, useValue: { isRunning: tourRunning } },
      ],
    });

    service = TestBed.inject(NewItemTypesAnnouncementService);
  });

  const copy = () => firstValueFrom(service.coachmarkCopy$);

  describe("coachmarkCopy$", () => {
    it("stays hidden until the page's onboarding sequence releases it", async () => {
      expect(await copy()).toBeNull();

      await service.release(false);

      expect(await copy()).not.toBeNull();
    });

    it("announces all three types when none are restricted", async () => {
      await service.release(false);

      expect(await copy()).toEqual({
        titleKey: "newItemTypesAvailable",
        descriptionKey: "addBankAccountsLicensesAndPassports",
      });
    });

    it("names the two types left when an admin restricts one", async () => {
      restrict(CipherType.DriversLicense);
      await service.release(false);

      expect(await copy()).toEqual({
        titleKey: "newItemTypesAvailable",
        descriptionKey: "addBankAccountsAndPassports",
      });
    });

    it("uses the singular title when only one type is left", async () => {
      restrict(CipherType.BankAccount, CipherType.Passport);
      await service.release(false);

      expect(await copy()).toEqual({
        titleKey: "newItemTypeAvailable",
        descriptionKey: "addLicenses",
      });
    });

    it("stays hidden when an admin restricts every new type", async () => {
      restrict(CipherType.BankAccount, CipherType.DriversLicense, CipherType.Passport);
      await service.release(false);

      expect(await copy()).toBeNull();
    });

    it("stays hidden when the new item types flag is off", async () => {
      flag$.next(false);
      await service.release(false);

      expect(await copy()).toBeNull();
    });

    it("stays hidden once dismissed", async () => {
      spotlightPending$.next(false);
      await service.release(false);

      expect(await copy()).toBeNull();
    });

    it("waits for the next session when other messaging showed", async () => {
      await service.release(true);

      expect(await copy()).toBeNull();
    });

    it("stays hidden while a coachmark tour is running", async () => {
      await service.release(false);
      tourRunning.set(true);

      expect(await copy()).toBeNull();
    });
  });

  describe("badgedTypes$", () => {
    it("badges the available new types", async () => {
      restrict(CipherType.Passport);

      expect(await firstValueFrom(service.badgedTypes$)).toEqual([
        CipherType.BankAccount,
        CipherType.DriversLicense,
      ]);
    });

    it("badges nothing once the badges were seen", async () => {
      badgePending$.next(false);

      expect(await firstValueFrom(service.badgedTypes$)).toEqual([]);
    });
  });

  it("dismisses the coachmark without touching the badges", async () => {
    await service.dismissCoachmark();

    expect(nudgesService.updateNudgeStatus).toHaveBeenCalledWith(
      NudgeType.NewItemTypesAnnouncement,
      userId,
      { hasSpotlightDismissed: true },
    );
  });

  it("dismisses the badges without touching the coachmark", async () => {
    await service.dismissBadges();

    expect(nudgesService.updateNudgeStatus).toHaveBeenCalledWith(
      NudgeType.NewItemTypesAnnouncement,
      userId,
      { hasBadgeDismissed: true },
    );
  });
});
